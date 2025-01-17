var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const Utility = obj.utility();
const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var schedule = require('node-schedule');

router.use(bodyParser.json());

const os = require("os");
const sql = require('sql');
sql.setDialect('postgres');

let Events = sql.define({
    name: 'events_archive',
    columns: [
        'id',
        'uuid',
        'created_at',
        'description',
        'payload',
        'source',
        'type',
        'msg_uuid',
        'bulk_id',
        'user_id',
        'tag',
        'title',
        'correlation_id',
        'me_payload',
        'error',
        'tenant'
    ]
});

const { json } = require("express");

var sources;
var types;

router.get('', async function (req, res, next) {

    let filter = req.query.filter ? req.query.filter : {};
    logger.debug("called GET /events, filter:", filter);

    try {
        var sql = buildQuery.select().table('events').filter(filter).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.events.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});

router.get('/_page', async function (req, res, next) {

    logger.debug("called GET /events/_page, filter:", req.query.filter);

    try {
        var sql_count = buildQuery.select().table("events as e")
            .filter(req.query.filter).count().sql;
        var sql_filtered = buildQuery.select("id, uuid, created_at, description, coalesce(Payload) as payload, source, type, msg_uuid, bulk_id, user_id, tag, title, correlation_id, me_payload, error, tenant")
            .table("events").filter(req.query.filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;

        logger.debug("sql_count: ",sql_count)
        logger.debug("sql: ",sql_filtered)
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var resultCount = await multiple_db.events.execute(sql_count);
        var resultQuery = await multiple_db.events.execute(sql_filtered);

        var result =
            {
                list: resultQuery,
                current_page: Math.round(req.query.offset / req.query.limit) + 1,
                total_pages: Math.ceil((resultCount[0].count) / req.query.limit),
                page_size: req.query.limit,
                total_elements: resultCount[0].count
            };
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});

router.get('/:id/payload', async function (req, res,next) {

    logger.debug("called GET /events/%s/payload", req.params.id);

    try {
        var sql = buildQuery.select("payload").table("events").filter({id: { eq: req.params.id}}).sql;
        logger.debug("sql:",sql)
    } catch (e) {
        return next({type: "client_error", status: 400, message: e});
    }

    try{
        var result = await multiple_db.events.execute(sql);
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }

    if(result.length === 0) return next({type: "info", status: 204});

    let payload = result[0].payload;
    try{
        payload = JSON.parse(payload);
    }catch(e){
        logger.error("error parsing payload: ", payload);
    }

    if(!payload || Object.keys(payload).length === 0) return next({type: "info", status: 204});

    res.attachment(req.params.id + "_events_payload_" + Utility.getDateFormatted(new Date()) + ".json");

    return next({type: "ok", status: 200, message: payload});
});

router.delete('', async function (req, res, next) {

    logger.debug("called DELETE /events, filter:", req.query.filter);

    try {
        var sql = buildQuery.select("id,msg_uuid,source,type,created_at").table("events").filter(req.query.filter).sql + " LIMIT " + req.query.limit;
        logger.debug("sql: ", sql);

        var list = await multiple_db.events.execute(sql);
        let payload = list.filter( e => e.msg_uuid && e.type === "OK").reduce( (r,e) => {
            if(!r[e.msg_uuid]) r[e.msg_uuid] = {};
            r[e.msg_uuid][e.source] = e.created_at;
            return r;
        },{} );

        let ids = list.map(e => e.id).join(",");

        var delete_sql = "DELETE FROM events WHERE id in (" + ids + " )";
        logger.debug("sql: ",delete_sql);
        var resultQuery = await multiple_db.events.execute(delete_sql);

        logger.debug("deleted records from events by operator");
        let values_to_insert = {
            uuid: Utility.uuid(),
            created_at: new Date().toISOString(),
            description: "deleted records from events by operator",
            source: conf.app_name + " " + os.hostname().split(".")[0],
            type: "ADMIN",
            payload: JSON.stringify(payload)
        };

        var insert_event = buildQuery.insert().table("events").values(values_to_insert).sql;
        await multiple_db.events.execute(insert_event);

        next({type: "ok", status: 200, message: resultQuery});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});

var isMovingEvents = false;
async function archiveEvents(){
    if(isMovingEvents) {
        logger.debug("archive events, process already running");
        return;
    }
    isMovingEvents = true;

    var setLock = "update lock_events_archive set owner_lock = 'unp', data_update = NOW(), note ='lock acquisito da unp' where owner_lock is null or owner_lock = ''";    
    var unsetLock = "update lock_events_archive set owner_lock = null, data_update = NOW(), note='lock rilasciato da unp';";
    var sql_limit_id = "select max(id) as max, min(id) as min from events;";
    var sql_select_t = "select id, uuid, created_at, description, payload, source, type, msg_uuid, bulk_id, user_id, tag, title, correlation_id, me_payload, error, tenant from events where id between :limit1 and :limit2";
    var sql_delete_t = "delete from events where id between :limit1 and :limit2";

    var connection, archive_connection;
    try{
        connection = await multiple_db.events.connect();
        archive_connection = await multiple_db.eventsarchive.connect();
        
        logger.debug("archive events, trying to set lock");
        let lock_events_archive = await archive_connection.query(setLock);

        if(lock_events_archive.rowCount === 0){
            logger.error("archive events, the system is already locked");
            isMovingEvents = false;
            return;
        }
        
        logger.debug("archive events, started events archive process");

        /*leave the last 1M record in events*/
        let cleanup_policy = Utility.parseNumberOrTime(conf.db_cleanup_policy.events.online || '100K');
        if(!cleanup_policy || cleanup_policy.type === 'days')
            throw new Error("events db cleanup policy (online) not valid or not supported");
        logger.debug("archive events, parsed online cleanup policy:", JSON.stringify(cleanup_policy));

        for (let index = 0; index < 100; index++) {
            logger.info("archive events, iteration " + index);
            logger.debug("archive events, get limit id: ", sql_limit_id);
            let maxMin = (await connection.query(sql_limit_id)).rows[0];
            logger.debug("archive events, limit query response: ", maxMin);
            let maxId = Number(maxMin.max);
            let minId = Number(maxMin.min);
            
            maxId -= cleanup_policy.value;

            if( (maxId - minId) > 0 ) {
                /* bisogna prendere al massimo 100 000 record, se è maggiore bisogna diminuire il numero di elementi da prendere a 100k*/
                if( (maxId - minId) > 1000 ) maxId = minId + 999;
                
                let sql_select = sql_select_t.replace(":limit2", maxId).replace(":limit1", minId);
                let sql_delete = sql_delete_t.replace(":limit2", maxId).replace(":limit1", minId);

                logger.debug("archive events, select query:", sql_select);
                let recordsToArchive = await connection.query(sql_select);
                logger.debug("archive events, planned to move " + recordsToArchive.rowCount + " records to archive db");

                let isInsertSuccessful = false;
                try {
                    //TODO
                    let sql_insert = Events.insert(recordsToArchive.rows).toQuery();
                    if(logger.isTraceEnabled) {
                        logger.trace(sql_insert);
                    }

                    let result_insert = await archive_connection.query(sql_insert);
                    if(logger.isTraceEnabled) {
                        logger.trace("insert result: ", result_insert);
                    }
                    logger.info("archive events, succesfully inserted " + result_insert.rowCount + " records to audit archive db");

                    isInsertSuccessful = true;
                } catch (e) {
                    logger.error("archive events, process got error in inserting records to history db:", e.message);
                }

                if(isInsertSuccessful) {
                    try {
                        if(logger.isDebugEnabled) {
                            logger.debug("archive events, delete sql:", sql_delete);
                        }
                        var result_delete = await connection.query(sql_delete);
                        logger.info("archive events, deleted " + result_delete.rowCount + " records from events");  
                    } catch (e) {
                        logger.error("archive events, process got error in deleting records from events db:", e.message);
                    }
                }
            } else {
                logger.info("archive events, nothing to do");
                break;
            }
        }

        await archive_connection.query(unsetLock);
        logger.debug("archive events, lock unsetted");
        logger.debug("archive events, process completed");                                              
        
    } catch(err) {
        logger.error("archive events, process got error in archiving records:", err.message);
    } finally {
        if(connection) await connection.release();
        if(archive_connection) await archive_connection.release();
        isMovingEvents = false;
    }
}

var isDeletingEvents = false;
async function deleteEvents() {
    if(isDeletingEvents) {
        logger.debug("delete events, process already running");
        return;
    }
    isDeletingEvents = true;

    let cleanup_policy;
    if(conf.db_cleanup_policy && conf.db_cleanup_policy.events && conf.db_cleanup_policy.events.offline) {
        logger.debug("delete events, get offline cleanup policy conf:", JSON.stringify(conf.db_cleanup_policy.events.offline));
        cleanup_policy = Utility.parseNumberOrTime(conf.db_cleanup_policy.events.offline);
    }
    
    if(!cleanup_policy || cleanup_policy.type === 'number') {
        logger.error("delete events, events db offline cleanup policy not valid or not supported");
        isDeletingEvents = false;
        return;
    }
    logger.debug("delete events, parsed offline cleanup policy:", JSON.stringify(cleanup_policy));

    var select_events_query = "select id from events_archive where created_at < now() - interval '" + cleanup_policy.value + " days' limit 100000";
    var delete_events_query = "delete from events_archive where id in (" + select_events_query + ")";
    
    try {
        for(let i=0; i<10; i++) {

            logger.debug("delete events, get records to delete query: ", select_events_query);
            var select_result = await multiple_db.eventsarchive.execute(select_events_query);
            logger.info("delete events, interation [%s] records to delete: %s", i, select_result.length);

            if(select_result.length === 0) {
                logger.info("delete events, nothing to do");
                break;
            }

            if(logger.isTraceEnabled) {
                logger.trace("delete events, records to delete:", select_result);
            }
            
            logger.debug("delete events, delete query:", delete_events_query);
            await multiple_db.eventsarchive.execute(delete_events_query);
            logger.info("delete events, deleted records from events");

            // try {
            //     let event_to_insert = {
            //         uuid: Utility.uuid(),
            //         created_at: new Date(),
            //         description: "deleted " + select_result.length + " records from events_archive",
            //         source: conf.app_name + " " + os.hostname().split(".")[0],
            //         type: "ADMIN",
            //         tenant: "deafult"
            //     };
            //     var insert_event = buildQuery.insert().table("events").values(event_to_insert).sql;
            //     await multiple_db.events.execute(insert_event);
            // } catch (e) {
            //     logger.warn("delete events, error while inserting event:", e.message);
            // }
        }
    } catch (e) {
        logger.error("delete events, process got error:", e.message);
    }

    try {
        // create table partition for next month
        let today = new Date();
        let month = today.getMonth() + 1;
        let year = today.getFullYear();
        let upper_limit_year, upper_limit_month;

        if(month >= 12) {
            month = 1;
            year = year + 1;
        } else {
            month = month + 1;
        }
        
        if(month < 12) {
            upper_limit_month = month + 1;
            upper_limit_year = year;
        } else {
            upper_limit_month = 1;
            upper_limit_year = year +1
        }

        let create_events_partition_sql = "CREATE TABLE IF NOT EXISTS events_archive_y"+ year + "m" + String(month).padStart(2,'0') + 
        " PARTITION OF events_archive FOR VALUES FROM ('" + year + "-" + String(month).padStart(2,'0') + "-01') TO ('" + upper_limit_year + "-" + String(upper_limit_month).padStart(2,'0') + "-01');"
        logger.debug("delete events, creating next month partition table:", create_events_partition_sql);
        await multiple_db.eventsarchive.execute(create_events_partition_sql);
    } catch (e) {
        logger.error("delete events, error while creating partition table:", e.message);
    }

    isDeletingEvents = false;
    logger.info("delete events, process completed");
}

let hostname = os.hostname();
if(conf.monitoring.masterhosts.includes(hostname)){
    logger.debug("scheduling archive events job");
    var jobArchiveEvents = schedule.scheduleJob('0/10 6-23 * * *', archiveEvents);
    var jobDeleteEvents = schedule.scheduleJob('0 3 * * *', deleteEvents);
}

router.get('/types', async function (req, res, next) {
    logger.debug("called GET /events/types, filter:", req.query.filter);
    next({type: "ok", status: 200, message: types});
});

router.get('/sources', async function (req, res, next) {
    logger.debug("called GET /events/sources, filter:", req.query.filter);
    next({type: "ok", status: 200, message: sources});
});

router.get('/messages', async function (req, res, next) {
    logger.debug("called GET /events/messages, filter:", req.query.filter);
    let filter = req.query.filter ? req.query.filter : {};

    try {
        var sql = buildQuery.select().table('message_events').filter(filter).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.events.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});

async function getTypes(){
    try {
        var sql = buildQuery.select().distinct().fields("type").table('events').sql;
        logger.debug("events controller, execute get types: ", sql);
        var result = await multiple_db.events.execute(sql);
        types = result.map(e=> e.type);
        logger.debug("event controller, updated types:", JSON.stringify(types, null, 4));
        return types;
    } catch (err) {
        logger.error("error in update types:", err);
    }
}

async function getSources(){
    try {
        var sql = buildQuery.select().distinct().fields("source").table('events').sql;
        logger.debug("events controller, execute get sources:", sql);
        var result = await multiple_db.events.execute(sql);
        sources = result.map(e=> e.source);
        logger.debug("events controller, updated sources:", JSON.stringify(sources, null, 4));
        return sources;
    } catch (err) {
        logger.error("error in update sources:", err);
    }
}

var updateSources = schedule.scheduleJob('0 * * * *', getSources);
var updateTypes = schedule.scheduleJob('0 * * * *', getTypes);

getSources();
getTypes();
module.exports = router;
