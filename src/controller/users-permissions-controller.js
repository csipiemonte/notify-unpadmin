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

router.get('/', async function (req, res, next) {
    
    let filter = req.query.filter ? req.query.filter : {};
    logger.debug("called GET /users-permissions, filter:", filter);

    try {
        var sql = buildQuery.select().table("users_permissions").filter(filter).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.unpadmin.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});

router.get('/:user_cf', async function (req, res, next) {
    logger.debug("called GET /users_permissions/%s", req.params.user_cf);
    try {
        var sql = buildQuery.select().table("users_permissions").filter({cf: {"eq": req.params.user_cf}}).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.unpadmin.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result[0] });
});

router.put('/:user_cf', async function (req, res, next) {
    
    var user = req.body;
    logger.debug("called PUT /users_permissions/%s, body: %s", req.params.user_cf, JSON.stringify(user));

    var deleteSql = buildQuery.delete().table("users_permissions").filter({cf: {"eq": user.cf}}).sql;
    var insertSql = buildQuery.insert().table("users_permissions")
        .values(user).sql;

    var sql = buildQuery.select().table("users_permissions").filter({cf: {"eq": user.cf}}).sql;

    try {
        var result = await multiple_db.unpadmin.execute(deleteSql + ";" + insertSql + ";" + sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});

router.delete('/:user_cf', async function (req, res, next) {
    
    logger.debug("called DELETE /users_permissions/%s", req.params.user_cf);

    var deleteSql = buildQuery.delete().table("users_permissions").filter({cf: {"eq": req.params.user_cf}}).sql;
    console.log("sql delete user:", deleteSql);

    try {
        var result = await multiple_db.unpadmin.execute(deleteSql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});

module.exports = router;