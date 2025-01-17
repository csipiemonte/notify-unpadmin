var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const utility = obj.utility();
const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

router.use(bodyParser.json());

router.get('/', async function (req, res,next) {

    logger.debug("called GET tags");
    
    var sql = buildQuery.select().table('tags').sort("+name").sql;
    
    try {
        var result = await multiple_db.unpadmin.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        logger.error(JSON.stringify(err));
        return next({type: "db_error", status: 500, message: err});
    }

});

router.post('/', async function (req, res,next) {

    logger.debug("called POST tags");
    var tag = req.body;

    try {
        var uuid = utility.uuid();
        tag.uuid = uuid;
        logger.info("adding tag:", tag);
        //var sql_delete = buildQuery.delete().table("services").filter({"uuid": {"eq": service.uuid}}).sql;
        var sql_insert = buildQuery.insert().table("tags").values(tag).sql;
        var select_sql = buildQuery.select().table("tags").filter({"uuid": {"eq": uuid}}).sql;
    } catch (err) {
        logger.error("Error adding a tag:", err);
        return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
    }

    try {
        var result = await multiple_db.unpadmin.execute(sql_insert + ";" + select_sql);
        return next({type: "ok", status: 200, message: result[1][0]})
    } catch (err) {
        logger.error("Error adding a tag:", err);
        return next({type: "db_error", status: 500, message: err})
    }
});

module.exports = router;

