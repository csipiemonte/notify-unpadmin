var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();
const Utility = obj.utility();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');


router.use(bodyParser.json());

var csvCreator = require('json2csv').Parser;


router.get('/messages', async function (req, res,next) {

    logger.debug("called report/messages: " + req.query.filter);

    try {
        var sql = buildQuery.select().table("messages").fields(req.query.fields).filter(req.query.filter)
            .sort(req.query.sort ? req.query.sort : "-timestamp").sql;
    } catch (e) {
        return next({type: "client_error", status: 400, message: e});
    }

    try{
        var result = await multiple_db.mex.execute(sql);
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }

    if (result.length === 0) return next({type: "info", status: 204, message: "there is no data"});

    let fields = [ 'id',
        'bulk_id',
        'user_id',
        'email_to',
        'email_subject',
        'email_body',
        'email_template_id',
        'sms_phone',
        'sms_content',
        'push_token',
        'push_title',
        'push_body',
        'push_call_to_action',
        'mex_title',
        'mex_body',
        'mex_call_to_action',
        'client_token',
        'sender',
        'tag',
        'correlation_id',
        'read_at',
        'timestamp' ];
    let json2csvParser = new csvCreator({ fields });
    let csv = json2csvParser.parse(result);

    res.attachment("messages_" + Utility.getDateFormatted(new Date()) + ".csv");
    /*res.setHeader('Content-disposition', 'attachment; filename=prova.csv');
    res.set('Content-Type', 'text/csv');*/
    return next({type: "ok", status: 200, message: csv});

});



router.get('/events', async function (req, res,next) {

    logger.debug("called report/csv/events: " + req.query.filter);

    try {
        var sql = buildQuery.select().table("events").fields(req.query.fields).filter(req.query.filter)
            .sort(req.query.sort ? req.query.sort : "-created_at").sql;
    } catch (e) {
        return next({type: "client_error", status: 400, message: e});
    }

    try{
        var result = await multiple_db.events.execute(sql);
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }

    if (result.length === 0) return next({type: "info", status: 204, message: "there is no data"});

    let fields = [ 'id','uuid','created_at','description','payload','source','type','msg_uuid','bulk_id','user_id','tag','title','correlation_id','me_payload','error' ];
    let json2csvParser = new csvCreator({ fields });
    let csv = json2csvParser.parse(result);

    res.attachment("events_" + Utility.getDateFormatted(new Date()) + ".csv");
    /*res.setHeader('Content-disposition', 'attachment; filename=prova.csv');
    res.set('Content-Type', 'text/csv');*/
    return next({type: "ok", status: 200, message: csv});

});



module.exports = router;
