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

    logger.debug("called GET /tenants");
    
    var sql = buildQuery.select().table('tenants').sort("+name").sql;
    
    try {
        var result = await multiple_db.unpadmin.execute(sql);
        result.filter(element => element.io_manage_apikey != null && element.io_manage_apikey.length > 4).forEach(element => {
            element.io_manage_apikey = element.io_manage_apikey.substring(0, element.io_manage_apikey.length - 4).replace(/\w/g, "*") + 
            element.io_manage_apikey.substring(element.io_manage_apikey.length - 4, element.io_manage_apikey.length);
        });
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        logger.error("error getting tenants", err);
        return next({type: "db_error", status: 500, message: err});
    }

});

router.post('/', async function (req, res,next) {

    var tenant = req.body;
    logger.debug("called POST /tenants, body:", tenant);

    try {
        var uuid = utility.uuid();
        tenant.uuid = uuid;
        logger.info("adding tenants:", tenant);
        //var sql_delete = buildQuery.delete().table("services").filter({"uuid": {"eq": service.uuid}}).sql;
        var sql_insert = buildQuery.insert().table("tenants").values(tenant).sql;
        var select_sql = buildQuery.select().table("tenants").filter({"uuid": {"eq": uuid}}).sql;
    } catch (err) {
        logger.error("Error adding a tenant:", err);
        return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
    }

    try {
        var result = await multiple_db.unpadmin.execute(sql_insert + ";" + select_sql);
        return next({type: "ok", status: 200, message: result[1][0]})
    } catch (err) {
        logger.error("Error adding a tenant:", err);
        return next({type: "db_error", status: 500, message: err})
    }
});

module.exports = router;