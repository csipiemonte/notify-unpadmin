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
var request = require('request');

router.use(bodyParser.json());

router.get('/services', async function (req, res,next) {

    logger.debug("called GET preferences/services");
    let filter = req.query.filter ? req.query.filter : {};
    var sql = buildQuery.select().table('services').filter(filter).sql;
    console.log("services:",sql)
    try {
        var result = await multiple_db.preferences.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

});

router.get('/services/tokens', async function (req, res,next) {

    logger.debug("called GET preferences/services");
    let filter = req.query.filter ? req.query.filter : {};
    var sql = buildQuery.select().table('services').filter(filter).sql;

    try {
        var result = await multiple_db.preferences.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    var resultServices = {};
    result.forEach( service => {
        resultServices[service.name] = service.token_notify;
    });


    next({type: "ok", status: 200, message: resultServices});

});

router.get('/services/:uuid', async function (req, res,next) {

    logger.debug("called GET preferences/services/%s",req.params.uuid);
    var sql = buildQuery.select().table('services').filter({uuid:{"eq":req.params.uuid}}).sql;

    try {
        var result = await multiple_db.preferences.execute(sql);
        if(!result || result.length === 0) return next({type: "ok", status: 204, message: {}});
        next({type: "ok", status: 200, message: result[0]});
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

});


router.put('/services', async function (req, res,next) {

    logger.debug("called PUT preferences/services");
    var service = req.body;


    if(service.channels && Array.isArray(service.channels)) service.channels = service.channels.join(",");
    try {
        var sql_delete = buildQuery.delete().table("services").filter({"uuid": {"eq": service.uuid}}).sql;
        var sql_insert = buildQuery.insert().table("services").values(service).sql;
        var select_sql = buildQuery.select().table("services").filter({"uuid": {"eq": service.uuid}}).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
    }

    try {
        var result = await multiple_db.preferences.execute(sql_delete + ";" + sql_insert + ";" + select_sql);
        return next({type: "ok", status: 200, message: result[2][0]})
    } catch (err) {
        return next({type: "db_error", status: 500, message: err})
    }
});

router.get('/users/contacts', async function (req, res,next) {

    logger.debug("called GET preferences/users/contacts with filter:  %s",req.query.filter);

    try{
        var sql_count = buildQuery.select().table("users").filter(req.query.filter).count().sql;
        var sql_filtered = buildQuery.select().table("users").filter(req.query.filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;

        logger.debug(sql_count);
        logger.debug(sql_filtered);

        var resultCount = await multiple_db.preferences.execute(sql_count);
        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        var result =
            {
                list: resultQuery,
                current_page: Math.round(req.query.offset / req.query.limit) + 1,
                total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
                page_size: req.query.limit,
                total_elements: resultCount[0].count
            };
        return next({type: "ok", status: 200, message: result});
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }

});

router.get('/users/:user_id/contacts/history',async function(req,res,next){

    logger.debug("called GET users/%s/contacts/history: ", + req.query.user_id);

    try{
        var sql_filtered = buildQuery.select().table("users_s").filter({user_id:{eq:req.query.user_id}})
            .sort("-timestamp").sql;

        logger.debug(sql_filtered);

        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        return next({type: "ok", status: 200, message: resultQuery});
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }
});
router.get('/users/contacts/:user_id', async function (req, res,next) {

    let user_id = req.params.user_id;
    logger.debug("called GET preferences/users/contacts/%s",user_id);
    if(user_id.length !== 32) user_id = utility.hashMD5(user_id);

    let filter = {user_id : {eq:user_id}};
    var sql = buildQuery.select().table('users').filter(filter).sql;
    var queryTerms = buildQuery.select().table("users_terms").filter(filter).sql;

    try {
        var result = await multiple_db.preferences.execute(sql);
        var resultTerms = await multiple_db.preferences.execute(queryTerms);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
    let user = result[0];
    if(result.length === 0 ) return next({type: "client_error", status: 404, message: "user not found"});
    if(resultTerms.length !==0) {
        user.terms = resultTerms[0];
        delete user.terms.user_id;
    }
    next({type: "ok", status: 200, message: user});

});


router.get('/users/:user_id/preferences/',async function (req, res,next) {

    logger.debug("called GET preferences/users/%s/preferences",req.params.user_id );

    let user_id = req.params.user_id;

    if(user_id.length !== 32) user_id = utility.hashMD5(user_id);
    let filter = {user_id : {eq:user_id}};
    var sql = buildQuery.select().table('users_services').filter(filter).sql;

    try {
        var result = await multiple_db.preferences.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});

});

router.get('/users/services',async function(req,res,next){

    logger.debug("called GET /users/services");
    var sql_users = buildQuery.select().table('users').sort("+user_id").sql;
    var sql_services = buildQuery.select().table('services').filter({"token_notify":{"null":"false","ne":""}}).sort("+name").sql;
    var sql_user_services = buildQuery.select().table('users as u').join().table('users_services as us').on("u.user_id = us.user_id").sql;

    try{
        var result_users = await multiple_db.preferences.execute(sql_users);
        var result_services = await multiple_db.preferences.execute(sql_services);
        var result_user_services = await multiple_db.preferences.execute(sql_user_services);
    }catch(err){
        return next({type: "db_error", status: 500, message: err});
    }

    let resultResponse = result_users.map( user => {
        let result ={};
        result.user_id = user.user_id;

        result.services = {};
        result_services.forEach(service => {
            let preference_for_service = result_user_services.filter(user_preference => user_preference.user_id === user.user_id &&
                user_preference.service_name === service.name)[0];
            result.services[service.name] = preference_for_service ? preference_for_service.channels : "";

        });

        return result;
    });

    next({type: "ok", status: 200, message: resultResponse});
});



router.get('/users/services/stats',async function(req,res,next){

    logger.debug("called GET /users/services");

    let sql_services = "SELECT * from services where not (tags @> ARRAY['hidden']);";
    let sql_push = "SELECT us.service_name,count(*) as push from services s join users_services us on s.name = us.service_name where us.channels like '%push%' and not (tags @> ARRAY['hidden']) group by us.service_name;";
    let sql_email = "SELECT us.service_name,count(*) as email from services s join users_services us on s.name = us.service_name where us.channels like '%email%' and not (tags @> ARRAY['hidden']) group by us.service_name;";
    let sql_sms = "SELECT us.service_name,count(*) as sms from services s join users_services us on s.name = us.service_name where us.channels like '%sms%' and not (tags @> ARRAY['hidden']) group by us.service_name;";
    let sql_mex = "SELECT us.service_name,count(*) as mex from services s join users_services us on s.name = us.service_name and not (tags @> ARRAY['hidden']) group by us.service_name;";

    try{
        var result_users = await multiple_db.preferences.execute(sql_services + sql_push + sql_email + sql_sms + sql_mex);
    }catch(err){
        return next({type: "db_error", status: 500, message: err});
    }

    let result = {};

    result_users[0].forEach( e => {
        result[e.name] = {
            push :0,
            email: 0,
            sms: 0,
            mex: 0
        }
    });

    let push = result_users[1];
    push = push.reduce((r,e) => {
        r[e.service_name] = e.push;
        return r;
    },{});

    let email = result_users[2];
    email = email.reduce((r,e) => {
        r[e.service_name] = e.email;
        return r;
    },{});

    let sms = result_users[3];
    sms = sms.reduce((r,e) => {
        r[e.service_name] = e.sms;
        return r;
    },{});


    let mex = result_users[4];
    mex = mex.reduce((r,e) => {
        r[e.service_name] = e.mex;
        return r;
    },{});

    Object.keys(result).forEach( service_name => {
        if(!result[service_name]) result[service_name]= {};
        result[service_name].push = push[service_name] || 0;
        result[service_name].sms = sms[service_name] || 0;
        result[service_name].email = email[service_name] || 0;
        result[service_name].mex = mex[service_name] || 0;
    });

    next({type: "ok", status: 200, message: result});
});





router.get('/users/_page',async function(req,res,next){

    logger.debug("called GET /users/_page: " + req.query.filter );

    let filter =JSON.parse(req.query.filter);

    if(filter['u.user_id'] && filter['u.user_id'].eq.length < 32) filter['u.user_id'].eq = utility.hashMD5(filter['u.user_id'].eq);

    try{
        var sql_count = buildQuery.select("u.user_id").table("users as u").join().table("users_services as us").on("u.user_id=us.user_id")
            .filter(filter).count().sql;

        var sql_filtered = buildQuery.select(" u.*").table("users as u").join().table("users_services as us").on("u.user_id=us.user_id")
            .filter(filter).sort(req.query.sort).page(req.query.limit, req.query.offset).sql;

        logger.debug(sql_count);
        logger.debug(sql_filtered);

        var resultCount = await multiple_db.preferences.execute(sql_count);
        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        var result =
            {
                list: resultQuery,
                current_page: Math.round(req.query.offset / req.query.limit) + 1,
                total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
                page_size: req.query.limit,
                total_elements: resultCount[0].count
            };
        return next({type: "ok", status: 200, message: result});
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }
});


router.get('/terms',async function(req,res,next){

    logger.debug("called GET /users: " + req.query.service + " " + req.query.channel );

    let query = "SELECT * from users_terms WHERE user_id='" + req.query.user_id +"';";
    let queryHistory = "select * from users_terms_s WHERE user_id='" + req.query.user_id +"' ORDER by accepted_at DESC";

    logger.debug(query);
    logger.debug(queryHistory);

    try{
        let result = await multiple_db.preferences.execute(query + queryHistory);
        let terms = {};
        terms.terms = result[0][0];
        terms.history_terms = result[1];
        return next({type: "ok", status: 200, message: terms});
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }
});

router.get('/users/count',async function(req,res,next){

    logger.debug("called GET /users/count " );

    let query = "SELECT count(*) as count from users";
    logger.debug(query);

    try{
        let count = await multiple_db.preferences.execute(query);
        return next({type: "ok", status: 200, message: count[0]});
    }catch(e){
        return next({type: "db_error", status: 500, message: e});
    }
});


module.exports = router;
