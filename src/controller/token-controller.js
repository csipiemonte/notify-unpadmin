var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const logger = obj.logger();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var util = require("util");
var cryptoAES_cbc = obj.cryptoAES_cbc();
var utility = obj.utility();

router.use(bodyParser.json());



router.get('/crypt', async function (req, res, next) {

    var token = req.query.token;
    token = utility.checkNested(conf,"security.crypto.password")? cryptoAES_cbc.encrypt(token,conf.security.crypto.password): token;

    next({type: "ok", status: 200, message: token});
});


router.get('/decrypt', async function (req, res, next) {

    var token = req.query.token;
    try{
        token = utility.checkNested(conf,"security.crypto.password")? cryptoAES_cbc.decrypt(token,conf.security.crypto.password): token;
    }catch(e){
        logger.debug("error in decrypt token: ",e);
        next({type: "client_error", status: 400, message: JSON.stringify(e)});
    }


    next({type: "ok", status: 200, message: token});
});


router.get('/decrypt_utility', async function (req, res, next) {

    var token = req.query.token;
    var password = req.query.password;
    try{
        token = cryptoAES_cbc.decrypt(token,password);
        return next({type: "ok", status: 200, message: token});
    }catch(e){
        logger.debug("error in decrypt token: ",e);
        return next({type: "client_error", status: 400, message: JSON.stringify(e)});
    }

});


router.put('/crypt_utility', async function (req, res, next) {

    var token = req.body.token;
    var password = req.body.password;
    console.log(req.body)

    try{
        token = cryptoAES_cbc.encrypt(token,password);
        return next({type: "ok", status: 200, message: token});
    }catch(e){
        logger.debug("error in decrypt token: ",e);
        return next({type: "client_error", status: 400, message: JSON.stringify(e)});
    }
});

module.exports = router;
