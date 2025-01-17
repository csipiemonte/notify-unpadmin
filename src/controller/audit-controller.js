var commons = require("../../../commons/src/commons");
var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

const Utility = obj.utility();

const os = require("os");
const sql = require('sql');
sql.setDialect('postgres');

let Audit = sql.define({
    name: 'audit_archive',
    columns: [
        'id',
        'uuid',
        'x_request_id',
        'timestamp',
        'client_name',
        'resource',
        'http_method',
        'query_params',
        'body',
        'http_protocol',
        'forwarded',
        'from_header',
        'host',
        'origin',
        'user_agent',
        'x_forwarded_for',
        'x_forwarded_host',
        'x_forwarded_proto',
        'headers',
        'http_status',
        'request_ip_address',
        'server_name',
        'server_ipaddress',
        'server_port',
        'app_name',
        'tenant'
    ]
  });

var schedule = require('node-schedule');

var app_names;
var clients;
router.use(bodyParser.json());

router.get('/_page', async function (req, res, next) {

    logger.debug("called audit/_page");

    console.log("filter:",req.query.filter);
    try {
        var sql_count = buildQuery.select().table("audit")
            .filter(req.query.filter).count().sql;
        var sql_filtered = buildQuery.select().table("audit").fields(req.query.fields).filter(req.query.filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;

        logger.debug("sql_count:",sql_count);
        logger.debug("sql_filtered:",sql_filtered);
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var resultCount = await multiple_db.audit.execute(sql_count);
        var resultQuery = await multiple_db.audit.execute(sql_filtered);

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

router.get('/clients', async function (req, res, next) {
    logger.debug("called audit/clients filters:", req.query.filter);
    next({type: "ok", status: 200, message: clients});
});

router.get('/app_names', async function (req, res, next) {
    logger.debug("called audit/app_names filters:", req.query.filter);
    next({type: "ok", status: 200, message: app_names});
});

module.exports = router;

var isMovingAudit = false;
async function archiveAudit() {
    if(isMovingAudit) {
        logger.error("archive audit, process already running");
        return;
    }
    isMovingAudit = true;

    var setLock = "update lock_audit_archive set owner_lock = 'unp', data_update = NOW(), note ='lock acquisito da unp' where owner_lock is null or owner_lock = ''";    
    var unsetLock = "update lock_audit_archive set owner_lock = null, data_update = NOW(), note='lock rilasciato da unp';";
    var sql_limit_id = "select max(id) as max, min(id) as min from audit";
    var sql_select_t = "select id, uuid, x_request_id, \"timestamp\", client_name, resource, http_method, query_params, body, http_protocol, forwarded, from_header, host, origin, user_agent, x_forwarded_for, x_forwarded_host, x_forwarded_proto, headers, http_status, request_ip_address, server_name, server_ipaddress, server_port, app_name, tenant from audit where id between :limit1 and :limit2";
    var sql_delete_t = "delete from audit where id between :limit1 and :limit2";

    var connection, archive_connection;
    try{
        connection = await multiple_db.audit.connect();
        archive_connection = await multiple_db.auditarchive.connect();
        
        logger.debug("archive audit, trying to set lock");
        let lock_audit_archive = await archive_connection.query(setLock);

        if(lock_audit_archive.rowCount === 0) {
            logger.error("archive audit, the system is already locked");   
            isMovingAudit = false;
            return;
        }
        
        logger.info("archive audit, started audit archive process");

        /*leave the last n (value read from configuration) records in audit*/
        let cleanup_policy = Utility.parseNumberOrTime(conf.db_cleanup_policy.audit.online || '100K');
        if(!cleanup_policy || cleanup_policy.type === 'days')
            throw new Error("audit db cleanup policy (online) not valid or not supported");
        logger.debug("archive audit, parsed online cleanup policy:", JSON.stringify(cleanup_policy));

        for (let index = 0; index < 100; index++) {
            logger.info("archive audit, iteration " + index);
            logger.debug("archive audit, get limit id: ", sql_limit_id);
            let maxMin = (await connection.query(sql_limit_id)).rows[0];
            logger.debug("archive audit, limit query response: ", maxMin);
            let maxId = Number(maxMin.max);
            let minId = Number(maxMin.min);
            
            maxId -= cleanup_policy.value;

            if( (maxId - minId) > 0 ) {
                /* bisogna prendere al massimo 1000 record, se è maggiore bisogna diminuire il numero di elementi da prendere a 1k*/
                if( (maxId - minId) > 1000 ) maxId = minId + 999;
                
                let sql_select = sql_select_t.replace(":limit2", maxId).replace(":limit1", minId);
                let sql_delete = sql_delete_t.replace(":limit2", maxId).replace(":limit1", minId);

                logger.debug("archive audit, select query:", sql_select);
                let recordsToArchive = await connection.query(sql_select);
                logger.debug("archive audit, planned to move " + recordsToArchive.rowCount + " records to archive db");

                let isInsertSuccessful = false;
                try {
                    let query_insert = Audit.insert(recordsToArchive.rows).toQuery();
                    if(logger.isTraceEnabled) {
                        logger.trace(query_insert);
                    }
                    
                    let result_insert = await archive_connection.query(query_insert);
                    if(logger.isTraceEnabled) {
                        logger.trace("insert result: ", result_insert);
                    }
                    logger.info("archive audit, succesfully inserted " + result_insert.rowCount + " records to audit archive db");
                    isInsertSuccessful = true;
                } catch (e) {
                    logger.error("archive audit, process got error in inserting records to history db:", e.message);
                }

                if(isInsertSuccessful) {
                    try {
                        if(logger.isDebugEnabled) {
                            logger.debug("archive audit, delete sql:", sql_delete);
                        }
                        var delete_result = await connection.query(sql_delete);
                        logger.info("archive audit, deleted " + delete_result.rowCount + " records from audit");
                    } catch (e) {
                        logger.error("archive audit, process got error in deleting records from audit db:", e.message);
                    }
                }
            } else {
                logger.info("archive audit, nothing to do");
                break;
            }
        }

        await archive_connection.query(unsetLock);
        logger.debug("archive audit, lock unsetted");
        logger.info("archive audit, process completed");
        
    } catch(err) {
        logger.error("archive audit, process got error in archiving records:", err.message);
    } finally {
        if(connection) await connection.release();
        if(archive_connection) await archive_connection.release();
        isMovingAudit = false;
    }
}

var isDeletingAudit = false;
async function deleteAudit() {
    if(isDeletingAudit) {
        logger.debug("delete audit, deleting process is already running");
        return;
    }
    isDeletingAudit = true;

    let cleanup_policy;
    if(conf.db_cleanup_policy && conf.db_cleanup_policy.audit && conf.db_cleanup_policy.audit.offline) {
        logger.debug("delete audit, get offline cleanup policy conf:", JSON.stringify(conf.db_cleanup_policy.audit.offline));
        cleanup_policy = Utility.parseNumberOrTime(conf.db_cleanup_policy.audit.offline);
    }

    if(!cleanup_policy || cleanup_policy.type === 'number') {
        logger.error("delete audit, db offline cleanup policy not valid or not supported");
        isDeletingAudit = false;
        return;
    }
    logger.debug("delete audit, started process, cleanup policy:", JSON.stringify(cleanup_policy));

    var select_audit_query = "SELECT id FROM audit_archive WHERE timestamp < NOW() - INTERVAL '" + cleanup_policy.value + " DAYS' limit 100000";
    var delete_audit_query = "DELETE FROM audit_archive WHERE id in (" + select_audit_query + ")";

    try {
        for(let i=0; i<10; i++) {

            logger.debug("delete audit, get audit records to delete: ", select_audit_query);
            var select_result = await multiple_db.auditarchive.execute(select_audit_query);
            logger.info("delete audit, iteration [%s] records to delete: %s", i, select_result.length);

            if(select_result.length === 0) {
                logger.info("delete audits, nothing to do");
                break;
            }

            if(logger.isTraceEnabled) {
                logger.trace("delete audit, records to delete:", select_result);
            }

            logger.debug("delete audit, delete query:", delete_audit_query);
            await multiple_db.auditarchive.execute(delete_audit_query);
            logger.info("delete audit, deleted records from audit");
            
            // try {
            //     let event = {
            //         uuid: Utility.uuid(),
            //         created_at: new Date().toISOString(),
            //         description: "deleted " + select_result.length + " records from audit_archive",
            //         source: conf.app_name + " " + os.hostname().split(".")[0],
            //         type: "ADMIN",
            //         tenant: "default"
            //     };
            //     var insert_event_sql = buildQuery.insert().table("events").values(event).sql;
            //     await multiple_db.events.execute(insert_event_sql);
            // } catch (e) {
            //     logger.warn("delete audit, error while inserting event:", e.message);
            // }
        }
    } catch(err) {
        logger.error("delete audit, got error:", err.message);
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

        let create_audit_partition_sql = "CREATE TABLE IF NOT EXISTS audit_archive_y"+ year + "m" + String(month).padStart(2,'0') + 
        " PARTITION OF audit_archive FOR VALUES FROM ('" + year + "-" + String(month).padStart(2,'0') + "-01') TO ('" + upper_limit_year + "-" + String(upper_limit_month).padStart(2,'0') + "-01');"
        logger.debug("delete audit, creating next month partition table:", create_audit_partition_sql);
        await multiple_db.auditarchive.execute(create_audit_partition_sql);
    } catch (e) {
        logger.error("delete audit, error while creating partition table:", e.message);
    }

    isDeletingAudit = false;
    logger.info("delete audit, process completed");
}

let hostname = os.hostname();
if(conf.monitoring.masterhosts.includes(hostname)) {
    logger.debug("scheduling audit jobs");
    var jobArchiveAudit = schedule.scheduleJob('5/10 6-23 * * *', archiveAudit);
    var jobDeleteAudit = schedule.scheduleJob('0 4 * * *', deleteAudit);
}

async function getClients() {
    try {
        var sql = buildQuery.select().distinct().fields("client_name").table('audit').sql;
        var result = await multiple_db.audit.execute(sql);
        clients = result.map(e=> e.client_name);
        logger.debug("audit controller, updated client_name: ", JSON.stringify(clients, null, 4));
        return clients;
    } catch (err) {
        logger.error("error getting clients: ", err);
    }
}

async function getAppNames() {
    try {
        var sql = buildQuery.select().distinct().fields("app_name").table('audit').sql;
        var result = await multiple_db.audit.execute(sql);
        app_names = result.map(e=> e.app_name);
        logger.debug("audit controller, updated app_name:", JSON.stringify(app_names, null, 4));
        return app_names;
    } catch (err) {
        logger.error("error getting app names: ", err);
    }
}

var updateClients = schedule.scheduleJob('0 * * * *', getClients);
var updateAppNames = schedule.scheduleJob('0 * * * *', getAppNames);

getClients();
getAppNames();
