var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();
const utility = obj.utility();
var schedule = require('node-schedule');

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var util = require("util");
var request = util.promisify(require('request'));
const os = require("os");

router.use(bodyParser.json());

const crypto = obj.cryptoAES_cbc();

var senders;

const decrypt = function(text) {
    try {
        return crypto.decrypt(text,conf.security.passphrase)
    } catch(e) {
        return text;
    }
};

router.get('/senders', async function (req, res,next) {
    logger.debug("called GET /messages/senders");
    next({type: "ok", status: 200, message: senders});
});

router.post('/queue/:client_token', async function (req, res,next) {

    logger.debug("called POST /messages/queue/%s", req.params.client_token);
    var mex = req.body;

    var options = {
        headers: {
            'x-authentication': req.params.client_token//conf.redis_token_jwt
        },
        url: conf.mb.queues.messages,
        method: 'POST',
        json: mex
    };

    try {
        var result = await request(options);
        if(result.statusCode !== 200 && result.statusCode !== 201){
            return next({type: "client_error", status: result.statusCode, message: "error sending message: " + result.body});
        }
    } catch(err) {
        return next({type: "system_error", status: 500, message: err});
    }
    next({type: "ok", status: 200, message: "message correctly sent"});
});

router.get('/_page', async function (req, res,next) {
    logger.debug("called GET /messages/_page, filter:", req.query.filter);
    let filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    if(filter.user_id && filter.user_id.eq && filter.user_id.eq.length !== 32) filter.user_id.eq = utility.hashMD5(filter.user_id.eq);

    try{
        var sql_count = buildQuery.select().table("messages")
            .filter(filter).count().sql;
        var sql = buildQuery.select().table('messages').filter(filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;
        logger.debug("sql_count: ",sql_count);
        logger.debug("sql: ",sql);
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var resultCount = await multiple_db.mex.execute(sql_count);
        var resultQuery = await multiple_db.mex.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    resultQuery = resultQuery.map( mex => {
        mex.email_subject = decrypt(mex.email_subject);
        mex.email_body = decrypt(mex.email_body);
        mex.sms_content = decrypt(mex.sms_content);
        mex.push_title = decrypt(mex.push_title);
        mex.push_body = decrypt(mex.push_body);
        mex.mex_title = decrypt(mex.mex_title);
        mex.mex_body = decrypt(mex.mex_body);
        mex.io = JSON.parse(decrypt(mex.io));
        mex.client_token = decrypt(mex.client_token);
        mex.memo = JSON.parse(mex.memo);
        return mex;
    });
    var result = {
        list: resultQuery,
        current_page: Math.round(req.query.offset / req.query.limit) + 1,
        total_pages: Math.ceil((resultCount[0].count) / req.query.limit),
        page_size: req.query.limit,
        total_elements: resultCount[0].count
    }; 
    next({type: "ok", status: 200, message: result});
});

router.get('/:uuid', async function (req, res,next) {
    logger.debug("called GET /messages/%s", req.params.uuid);

    try {
        var sql = buildQuery.select().table('messages').filter({id: {eq : req.params.uuid}}).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var resultQuery = await multiple_db.mex.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
    next({type: "ok", status: 200, message: resultQuery});
});

module.exports = router;

async function getSenders(){
    try{
        var sql = buildQuery.select("sender").table('messages').groupBy("sender").sql;
        var result = await multiple_db.mex.execute(sql);
        senders = result.map(e=> e.sender);
        logger.debug("updated senders:", senders);
        return senders;
    } catch (err) {
        logger.error("got error getting senders:", err);
    }
}

var updateSenders = schedule.scheduleJob('0 * * * *', getSenders);
getSenders();

var isDeletingArchivedMessages = false;
async function deleteArchivedMessages() {
    if(isDeletingArchivedMessages) {
        logger.debug("delete archived messages, process already running");
        return;
    }
    isDeletingArchivedMessages = true;

    let cleanup_policy = utility.parseNumberOrTime(conf.db_cleanup_policy.mex.online || '99y');
    if(!cleanup_policy || cleanup_policy.type === 'number') {
        logger.error("mex db cleanup policy (online) not valid or not supported");
        isDeletingArchivedMessages = false;
        return;
    }
    logger.debug("delete archived messages, parsed online cleanup policy:", JSON.stringify(cleanup_policy));

    var select_messages_query = "select id from messages where timestamp < now() - interval '" + cleanup_policy.value + " days' limit 100000";
    var count_messages_query = "select count(id) as c from (" + select_messages_query + ") as mex";
    var delete_messages_query = "delete from messages where id in (" + select_messages_query + ")";

    try{
        for(let i=0; i<10; i++) {

            logger.debug("delete archived messages, get archived messages to delete: ", select_messages_query);
            var count_result = await multiple_db.mex.execute(count_messages_query);
            logger.debug("delete archived messages, iteration [%s] records to delete: %s", i, count_result[0].c);

            if(Number(count_result[0].c) === 0) {
                isDeletingArchivedMessages = false;
                logger.debug("delete archived messages, no more records to delete, bye");
                return;
            }

            logger.debug("delete archived messages, delete query:", delete_messages_query);
            var result = await multiple_db.mex.execute(delete_messages_query);
            logger.debug("delete archived messages, deleted records from messages");

            try {
                let values_to_insert = {
                    uuid: utility.uuid(),
                    created_at: new Date().toISOString(),
                    description: "deleted " + count_result[0].c + " records from messages",
                    source: conf.app_name + " " + os.hostname().split(".")[0],
                    type: "ADMIN"
                };
                var insert_event = buildQuery.insert().table("events").values(values_to_insert).sql;
                await multiple_db.events.execute(insert_event);
            } catch (e) {
                logger.warn("delete archived messages, error while inserting event:", e.message);
            }
        }
    } catch(err) {
        logger.error("delete archived messages, process got error in deleting records:", err.message);
    }
    isDeletingArchivedMessages = false;
}

let hostname = os.hostname();
if(conf.monitoring.masterhosts.includes(hostname)) {
    logger.debug("scheduling messages management jobs");
    var jobDeleteArchivedMessages = schedule.scheduleJob('0 5 * * *', deleteArchivedMessages);
}