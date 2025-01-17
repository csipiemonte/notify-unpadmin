var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var util = require("util");
var request = util.promisify(require('request'));
var cryptoAES_cbc = obj.cryptoAES_cbc();

const Redis = require("ioredis");
const redis = new Redis(conf.redis);
const fs = require("fs");

router.use(bodyParser.json());

var jwt = require('jsonwebtoken');

router.get('/', async function (req, res, next) {
    logger.debug("called GET /clients, filters:", req.query.filter);
    let filter = req.query.filter ? req.query.filter : {};

    try {
        var sql = buildQuery.select().table("clients").filter(filter).sql;
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

router.get('/:client_id', async function (req, res, next) {
    logger.debug("called GET /clients/%s", req.params.client_id);
    try {
        var sql = buildQuery.select().table("clients").filter({"client_id": {"eq": req.params.client_id}}).sql;
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

router.get('/services/:service_name', async function (req, res, next) {
    logger.debug("called GET /clients/services/%s", req.params.service_name);
    try {
        var sql = buildQuery.select().table("clients").filter({"preference_service_name": {"eq": req.params.service_name}}).sql;
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

router.put('', async function (req, res, next) {
    logger.debug("called PUT /clients, body:", JSON.stringify(req.body));

    var client = req.body;

    var deleteSql = buildQuery.delete().table("clients").filter({"client_id": {"eq": client.client_id}}).sql;
    var insertSql = buildQuery.insert().table("clients")
        .values(client).sql;

    var sql = buildQuery.select().table("clients").filter({"client_id": {"eq": client.client_id}}).sql;

    try {
        var result = await multiple_db.unpadmin.execute(deleteSql + ";" + insertSql + ";" + sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});

router.get('/:client_id/token', function (req, res, next) {

    let payload = req.query.payload;
    logger.debug("called GET /clients/%s/token, query.payload:%s", req.params.client_id, payload);

    var token = jwt.sign(JSON.parse(payload), conf.security.secret);
    next({type: "ok", status: 200, message: token});
});

router.get('/:client_id/token/:application', function (req, res) {

    logger.debug("called GET /clients/%s/token/%s", req.params.client_id, req.params.application);

    var sql = buildQuery.select().table("clients").filter({"client_id": {"eq": req.params.client_id}}).sql;
    logger.debug("select client: ", sql);
    db.query(sql, (err, result) => {
        if (err) return Utility.errorHandler(res, 500, err);
        if (!result) return Utility.errorHandler(res, 404, "client not found");

        var url = conf.preferences.url + "services";
        var options = {
            url: url,
            headers: {
                'x-authentication': conf.preferences.token
            },
            qs: {filter: {"name": {"eq": result[0].service_preference}}}
        };
        logger.debug("calling in GET external preferences at:", url);
        request(options, function (error, response, body) {
            if (error || response.statusCode !== 200) {
                logger.error('error while calling rest service preferences/services: ',
                    error ? error : body, response ? response.statusCode : 500);
                return Utility.errorHandler(res, 500, error ? error : body);
            }

            let payload = {
                uuid: Utility.uuid(),
                client_name: result[0].client_name,
                client_uuid: req.params.client_id,
                preference_service_name: result[0].service_preference,
                exp: parseInt(req.query.expire),
                iat: new Date().getTime(),
                applications: req.params.application.split(","),
                permissions: req.query.permissions,
                preferences: {}
            };

            logger.debug("response from preferences:", body);
            var service = JSON.parse(body)[0];
            logger.debug("response first element:", service);

            service.channels.split(",").forEach(e => payload.preferences[e.toLowerCase()] = service["sender_" + e.toLowerCase()]);

            logger.debug("token payload:", payload);

            var token = jwt.sign(payload, conf.secret_jwt_key);
            logger.debug("token:", token);
            res.end(token);
        });
    });
});

/**
 * get possible values of a enum column type of services_registry
 */
router.get('/column_types/service_types', function (req, res) {

    var sql = buildQuery.columnInformation(conf.mysql.database, "services_registry", "service_type").sql;
    logger.debug("called GET /clients/column_types/service_types:", sql);
    db.query(sql, (err, result) => {
        if (err) return Utility.errorHandler(res, 500, err);
        var type = result[0].type.substring(5).replace(/\)/g, "").replace(/'/g, "").split(",");
        logger.debug("services_type: ", type);
        res.end(JSON.stringify(type));
    });
});

module.exports = router;