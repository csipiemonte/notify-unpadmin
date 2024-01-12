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

var sources;
var types;

router.get('', async function (req, res, next) {

    logger.debug("called GET events");
    let filter = req.query.filter ? req.query.filter : {};

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

    logger.debug("called events/_page with filter:",req.query.filter);

    try {
        var sql_count = buildQuery.select().table("events as e")
            .filter(req.query.filter).count().sql;
        var sql_filtered = buildQuery.select("id, uuid, created_at, description, coalesce(Payload) as payload, source, type, msg_uuid, bulk_id, user_id, tag, title, correlation_id, me_payload, error")
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
                total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
                page_size: req.query.limit,
                total_elements: resultCount[0].count
            };
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});

router.get('/:id/payload', async function (req, res,next) {

    logger.debug("called :id/payload: " + req.params.id);

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
        logger.error("error parsing payload: ",payload);
    }

    if(!payload || Object.keys(payload).length === 0) return next({type: "info", status: 204});


    res.attachment(req.params.id + "_events_payload_" + Utility.getDateFormatted(new Date()) + ".json");

    return next({type: "ok", status: 200, message: payload});

});

router.delete('', async function (req, res, next) {

    logger.debug("called delete events: ",req.query.filter);

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
            created_at: Utility.getDateFormatted(new Date()),
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



var deleting = false;
async function deleteOldrecord(){
    if(deleting) {
        logger.debug("events deleting already running");
        return;
    }
    deleting = true;
    logger.debug("trying to delete old records in events");

    var setLock = "update lock_events_sdp set owner_lock = 'unp',data_update = NOW(),note ='lock acquisito da unp' where owner_lock is null or owner_lock = ''";    
    var sql_esito = "select * from esito_ingestion_sdp where esito=true order by data_fine desc limit 1;";
    var deleting_sdp = "delete from events_sdp where id between :min_id and :max_id;";
    var unsetLock = "update lock_events_sdp set owner_lock = null,data_update = NOW(),note='lock rilasciato da unp';";
    var sql_limit_id = "select max(id) as max, min(id) as min from events;";
    var sql_insert = "insert into events_sdp select * from events where id between :limit1 and :limit2";
    var sql_delete = "delete from events where id between :limit1 and :limit2";

    var connection = await multiple_db.events.connect();
    try{
        logger.debug("start transaction");
        await connection.query('BEGIN'); 
        logger.debug("trying to set lock");   
        let lock_sdp = await connection.query(setLock);

        if(lock_sdp.rowCount === 0){
            logger.debug("the system is locked");   
            await connection.query('COMMIT');
            deleting = false;     
            return;
        }
        
        logger.debug("executing esito query: ", sql_esito);
        let esito = (await connection.query(sql_esito)).rows;
        if(esito[0] && esito[0].data_fine !== null && esito[0].data_fine !== ""){
            deleting_sdp = deleting_sdp.replace(":min_id",esito[0].min_id_record).replace(":max_id",esito[0].max_id_record);
            logger.debug("deleting_sdp: ", deleting_sdp);
            await connection.query(deleting_sdp);
        } 

        logger.debug("get limit id: ", sql_limit_id);
        let maxMin = (await connection.query(sql_limit_id)).rows[0];
        logger.debug("Limit query response: ", maxMin);
        /*leave the last 100 000 record in events*/
        maxMin.max -= 100000; 
        /* bisogna prendere al massimo 100 000 record, se è maggiore bisogna diminuire il numero di elementi da prendere a 100k*/
        if( (maxMin.max - maxMin.min) > 100000 ) maxMin.max = maxMin.min + 100000;
        
        sql_insert = sql_insert.replace(":limit2",maxMin.max).replace(":limit1",maxMin.min);
        sql_delete = sql_delete.replace(":limit2",maxMin.max).replace(":limit1",maxMin.min);

        logger.debug("events_sdp insert sql: ", sql_insert);
        await connection.query(sql_insert);

        logger.debug("events_sdp delete sql: ",sql_delete);
        var result = await connection.query(sql_delete);
        logger.debug("events_sdp deleted " + result.rowCount + " records from events");  

        await connection.query(unsetLock);
        logger.debug("lock status unsetted");

        await connection.query('COMMIT');
        logger.debug("(COMMIT) sdp operation successfully completed");                                              
        
    }catch(err){
        await connection.query('ROLLBACK');
        logger.error("(ROLLBACK) error in delete events old records: ",err);
    }finally{
        await connection.release();
        deleting = false;
    }    
}

deleteOldrecord()
let hostname = os.hostname();
if(conf.monitoring.master_hosts.includes(hostname)){
    logger.debug("scheduling jobs for delete events");    
    var jobDeleteOldRecord = schedule.scheduleJob('*/10 0-22 * * *', deleteOldrecord);    
}

router.get('/types', async function (req, res, next) {
    logger.debug("called types/ filters:", req.query.filter);
    next({type: "ok", status: 200, message: types});
});


router.get('/sources', async function (req, res, next) {
    logger.debug("called sources/ filters:", req.query.filter);
    next({type: "ok", status: 200, message: sources});
});




router.get('/messages', async function (req, res, next) {
    logger.debug("called messages/ filters:", req.query.filter);
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
        logger.debug("execute get types: ",sql);
        var result = await multiple_db.events.execute(sql);
        types = result.map(e=> e.type);
        logger.debug("updated types: ",types);
        return types;
    } catch (err) {
        logger.error("error in update types: ",err);
        throw err;
    }
}

async function getSources(){
    try {
        var sql = buildQuery.select().distinct().fields("source").table('events').sql;
        logger.debug("execute get sources: ",sql);
        var result = await multiple_db.events.execute(sql);
        sources = result.map(e=> e.source);
        logger.debug("updated sources: ",sources);
        return sources;
    } catch (err) {
        logger.error("error in update sources: ",err);
        throw err;
    }
}

var updateSources = schedule.scheduleJob('0 * * * *', getSources);
var updateTypes = schedule.scheduleJob('0 * * * *', getTypes);

getSources();
getTypes();
module.exports = router;
