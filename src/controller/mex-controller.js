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

router.use(bodyParser.json());

const crypto = obj.cryptoAES_cbc();

var senders;

const decrypt = function(text){ try{
    return crypto.decrypt(text,conf.security.passphrase)
}catch(e){
    return text;
}
};

router.get('/senders', async function (req, res,next) {
    logger.debug("called get /messages/senders");
    next({type: "ok", status: 200, message: senders});
});

router.post('/queue/:client_token', async function (req, res,next) {

    logger.debug("called mex/queue");
    var mex = req.body;

    var options = {
        headers: {
            'x-authentication': req.params.client_token//conf.redis_token_jwt
        },
        url: conf.mb.queues.messages,
        method: 'POST',
        json: mex
    };

    try{
        var result = await request(options);
        if(result.statusCode !== 200 && result.statusCode !== 201){
            return next({type: "client_error", status: result.statusCode, message: "error sending message: " + result.body});
        }
    }catch(err){
        return next({type: "system_error", status: 500, message: err});
    }
    next({type: "ok", status: 200, message: "message correctly sent"});
});

router.get('/_page', async function (req, res,next) {
    logger.debug("called messages/ filters:",req.query.filter);
    let filter = req.query.filter ? JSON.parse(req.query.filter) : {};

    if(filter.user_id && filter.user_id.eq && filter.user_id.eq.length !== 32) filter.user_id.eq = utility.hashMD5(filter.user_id.eq);

    try{
        var sql_count = buildQuery.select().table("messages")
            .filter(filter).count().sql;
        var sql = buildQuery.select().table('messages').filter(filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;
        logger.debug("sql_count: ",sql_count);
        logger.debug("sql: ",sql);
    }catch (err){
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
    var result =
        {
            list: resultQuery,
            current_page: Math.round(req.query.offset / req.query.limit) + 1,
            total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
            page_size: req.query.limit,
            total_elements: resultCount[0].count
        }; 
    next({type: "ok", status: 200, message: result});
});

router.get('/:uuid', async function (req, res,next) {
    logger.debug("called messages/:uuid :",req.params.uuid);

    try{
        var sql = buildQuery.select().table('messages').filter({id: {eq : req.params.uuid}}).sql;
    }catch (err){
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var resultQuery = await multiple_db.mex.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
    next({type: "ok", status: 200, message: resultQuery});
});

async function getSenders(){
    try{

        var sql = buildQuery.select("sender").table('messages').groupBy("sender").sql;
        var result = await multiple_db.mex.execute(sql);
        senders = result.map(e=> e.sender);
        logger.debug("updated senders: ",senders);
        return senders;
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
}

var updateSenders = schedule.scheduleJob('0 * * * *', getSenders);

getSenders();

module.exports = router;