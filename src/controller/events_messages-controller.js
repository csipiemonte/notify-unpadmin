var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

router.use(bodyParser.json());

router.get('', async function (req, res,next) {
    logger.debug("called messages_events/ filters:",req.query.filter);
    let filter = req.query.filter ? req.query.filter : {};

    try{
        var sql = buildQuery.select().table('message_events').filter(filter).sql;
    }catch (err){
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.events.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
});


module.exports = router;