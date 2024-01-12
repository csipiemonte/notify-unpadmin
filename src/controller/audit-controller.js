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
                total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
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

var deleting = false;
async function deleteOldrecord(){
    if(deleting) {
        logger.debug("audit deleting already running");
        return;
    }
    deleting = true;
    logger.debug("trying to delete old records in audit");

    var sql = "SELECT * FROM audit WHERE (client_name in('emailconsumer','pushconsumer','smsconsumer') and timestamp < (NOW() - INTERVAL '7 DAYS')) or (timestamp < (NOW() - INTERVAL '90 DAYS')) LIMIT 10000";
    var delete_sql = "DELETE FROM audit WHERE id in (select id from (" + sql + ") as a)";

    try {

        logger.debug("get audit records to delete: ", sql);
        var list = await multiple_db.audit.execute(sql);

        if(list.length === 0) {
            deleting = false;
            logger.debug("no records to delete");
            return;
        }

        logger.debug("delete audit sql: ",delete_sql);
        var result = await multiple_db.audit.execute(delete_sql);
        logger.debug("deleted old records from audit");

        let values_to_insert = {
            uuid: Utility.uuid(),
            created_at: Utility.getDateFormatted(new Date()),
            description: "deleted old records from audit",
            source: conf.app_name + " " + os.hostname().split(".")[0],
            type: "ADMIN"
        };

        var insert_event = buildQuery.insert().table("events").values(values_to_insert).sql;
        await multiple_db.events.execute(insert_event);
    }catch(err){
        logger.error("error in delete audit old records: ",err.message);
    }

    deleting = false;
}


let hostname = os.hostname();
if(conf.monitoring.master_hosts.includes(hostname)){
    logger.debug("scheduling jobs for delete audit records");
    var jobNight = schedule.scheduleJob('*/10 19-23 * * *', deleteOldrecord);
    var jobDay = schedule.scheduleJob('*/10 0-07 * * *', deleteOldrecord);
}

async function getClients(){
    try {
        var sql = buildQuery.select().distinct().fields("client_name").table('audit').sql;
        var result = await multiple_db.audit.execute(sql);
        clients = result.map(e=> e.client_name);
        logger.debug("updated client_name: ",clients);
        return clients;
    } catch (err) {
        logger.error("error getting clients: ",err);
        throw err;
    }
}

async function getAppNames(){
    try {
        var sql = buildQuery.select().distinct().fields("app_name").table('audit').sql;
        var result = await multiple_db.audit.execute(sql);
        app_names = result.map(e=> e.app_name);
        logger.debug("updated app_name: ",clients);
        return clients;
    } catch (err) {
        logger.error("error getting app_names: ",err);
        throw err;
    }
}

var updateClients = schedule.scheduleJob('0 * * * *', getClients);
var updateAppNames = schedule.scheduleJob('0 * * * *', getAppNames);

getClients();
getAppNames();
