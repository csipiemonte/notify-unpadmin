var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
const logger = obj.logger();
const redis = new require('ioredis')(conf.redis);

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

router.use(bodyParser.json());


router.post('/keys/:key', async function (req, res, next) {
    logger.debug("called POST /api/v1/redis/keys/" + req.params.key);

    var content = req.body;

    try {
        let result = await redis.hset(req.params.key,content.key, content.value);
        return next({type: "ok", status: 200, message: result + ""});
    } catch (err) {
        logger.debug("error:", err);
        return next({type: "system_error", status: 500, message: err});
    }
});

router.get('/keys/:key', async function (req, res, next) {
    logger.debug("called /redis/keys/",req.params.key);
    try{
        let result = await redis.hgetall(req.params.key);
        return next({type: "ok", status: 200, message: result});
    }catch(err){
        logger.error("error in get key: ",err);
        return next({type: "system_error", status: 500, message: err});
    }
});

router.delete('/keys/:key/:hmkey', async function (req, res, next) {
    logger.debug("called DELETE /api/v1/redis/keys/" + req.params.key);

    try {

        let result = await redis.hdel(req.params.key,req.params.hmkey);
        return next({type: "ok", status: 200, message: result + ""});
    } catch (err) {
        logger.debug("error:", err);
        return next({type: "system_error", status: 500, message: err});
    }
});

module.exports = router;