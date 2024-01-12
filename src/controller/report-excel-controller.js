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

var excelCreator = require('./../utilities/excelCreator');


router.get('/messages', async function (req, res) {

    logger.debug("called report/excel/messages: " + req.query.filter);

    try {
        var sql = buildQuery.select().table("messages").fields(req.query.fields).filter(req.query.filter)
            .sort(req.query.sort ? req.query.sort : "-timestamp").sql;
    } catch (e) {
        return next({type: "client_error", status: 400, message: e});
    }


    try {
        var result = await multiple_db.mex.execute(sql);
    } catch (e) {
        return next({type: "db_error", status: 500, message: e});
    }

    if (result.length === 0) return next({type: "info", status: 204, message: "there is no data"});

    var styleHeader = {
        font: {
            color: '#000000',
            size: 12,
            bold: true
        }
    };

    var styleContent = {
        numberFormat: 'yyyy-MM-dd HH:mm:ss'
    };


    var fields = req.query.fields ? req.query.fields.split(",") : Object.keys(result[0]);
    excelCreator.sheet("messages").header(fields, styleHeader).content(result, styleContent).write("messages_" + Utility.getDateFormatted(new Date()) + ".xlsx", res);

});


router.get('/events', async function (req, res) {

    logger.debug("called report/excel/events: " + req.query.filter);

    try {
        var sql = buildQuery.select().table("events").fields(req.query.fields).filter(req.query.filter)
            .sort(req.query.sort ? req.query.sort : "-created_at").sql;
    } catch (e) {
        return next({type: "client_error", status: 400, message: e});
    }


    try {
        var result = await multiple_db.events.execute(sql);
    } catch (e) {
        return next({type: "db_error", status: 500, message: e});
    }

    if (result.length === 0) return next({type: "info", status: 204, message: "there is no data"});

    var styleHeader = {
        font: {
            color: '#000000',
            size: 12,
            bold: true
        }
    };

    var styleContent = {
        numberFormat: 'yyyy-MM-dd HH:mm:ss'
    };


    var fields = req.query.fields ? req.query.fields.split(",") : Object.keys(result[0]);
    excelCreator.sheet("events").header(fields, styleHeader).content(result, styleContent).write("events_" + Utility.getDateFormatted(new Date()) + ".xlsx", res);

});

module.exports = router;
