var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const utility = obj.utility();
var cryptoAES_cbc = obj.cryptoAES_cbc();
var jwt = require('jsonwebtoken');
const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

const os = require("os");
var schedule = require('node-schedule');

router.use(bodyParser.json());

router.get('/services', async function (req, res,next) {

    let filter = req.query.filter ? req.query.filter : {};
    logger.debug("called GET /preferences/services, filter:", filter);
    
    var sql = buildQuery.select().table('services').filter(filter).sql;
    try {
        var result = await multiple_db.preferences.execute(sql);
        next({type: "ok", status: 200, message: result});
    } catch (err) {
        logger.error(JSON.stringify(err));
        return next({type: "db_error", status: 500, message: err});
    }
});

router.get('/services/tokens', async function (req, res,next) {

    let filter = req.query.filter ? req.query.filter : {};
    logger.debug("called GET /preferences/services/token, filter:", filter);
    
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

    logger.debug("called GET /preferences/services/%s", req.params.uuid);
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

    var service = req.body;
    logger.debug("called PUT /preferences/services, body:", JSON.stringify(service));

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

    logger.debug("called GET /preferences/users/contacts, filter:", req.query.filter);

    try {
        var sql_count = buildQuery.select().table("users").filter(req.query.filter).count().sql;
        var sql_filtered = buildQuery.select().table("users").filter(req.query.filter)
            .sort(req.query.sort).page(req.query.limit, req.query.offset).sql;

        logger.debug("sql count users:", sql_count);
        logger.debug("sql get filtered users:", sql_filtered);

        var resultCount = await multiple_db.preferences.execute(sql_count);
        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        var result = {
            list: resultQuery,
            current_page: Math.round(req.query.offset / req.query.limit) + 1,
            total_pages: Math.trunc((resultCount[0].count) / req.query.limit) + 1,
            page_size: req.query.limit,
            total_elements: resultCount[0].count
        };
        return next({type: "ok", status: 200, message: result});
    } catch(e) {
        return next({type: "db_error", status: 500, message: e});
    }
});

router.get('/users/:user_id/contacts/history',async function(req,res,next){

    logger.debug("called GET /preferences/users/%s/contacts/history", req.query.user_id);

    try {
        var sql_filtered = buildQuery.select().table("users_s").filter({user_id:{eq:req.query.user_id}, tenant:{eq:req.query.tenant}})
            .sort("-timestamp").sql;

        logger.debug("sql get user history:", sql_filtered);

        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        return next({type: "ok", status: 200, message: resultQuery});
    } catch(e) {
        return next({type: "db_error", status: 500, message: e});
    }
});

router.get('/users/contacts/:user_id', async function (req, res,next) {

    let user_id = req.params.user_id;
    logger.debug("called GET /preferences/users/contacts/%s", user_id);
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

router.get('/tenants/:tenant/users/:user_id/contacts', async function (req, res,next) {

    let user_id = req.params.user_id;
    let tenant = req.params.tenant;
    
    logger.debug("called GET /preferences/tenants/%s/users/%s/contacts", tenant, user_id);
    
    if(user_id.length !== 32) user_id = utility.hashMD5(user_id);

    let filter = {user_id : {eq: user_id}, tenant: {eq: tenant}};
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

    let user_id = req.params.user_id;
    logger.debug("called GET /preferences/users/%s/preferences", user_id);

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

router.get('/tenants/:tenant/users/:user_id/preferences/',async function (req, res,next) {

    logger.debug("called GET /preferences/tenants/%s/users/%s/preferences", req.params.tenant, req.params.user_id);

    let user_id = req.params.user_id;
    let tenant = req.params.tenant;

    if(user_id.length !== 32) user_id = utility.hashMD5(user_id);
    let filter = {user_id : {eq: user_id}, tenant: {eq: tenant}};
    var sql = buildQuery.select().table('users_services').filter(filter).sql;

    try {
        var result = await multiple_db.preferences.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});

router.get('/users/services',async function(req,res,next){

    logger.debug("called GET /preferences/users/services");
    var sql_users = buildQuery.select().table('users').sort("+user_id").sql;
    var sql_services = buildQuery.select().table('services').filter({"token_notify":{"null":"false","ne":""}}).sort("+name").sql;
    var sql_user_services = buildQuery.select().table('users as u').join().table('users_services as us').on("u.user_id = us.user_id AND u.tenant = us.tenant").sql;

    try {
        var result_users = await multiple_db.preferences.execute(sql_users);
        var result_services = await multiple_db.preferences.execute(sql_services);
        var result_user_services = await multiple_db.preferences.execute(sql_user_services);
    } catch(err) {
        return next({type: "db_error", status: 500, message: err});
    }

    let resultResponse = result_users.map( user => {
        let result ={};
        result.user_id = user.user_id;
        result.tenant = user.tenant;

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

router.get('/users/services/stats', async function(req, res, next) {

    logger.debug("called GET /preferences/users/services/stats");

    let sql_services =  "SELECT * from services where not (tags @> ARRAY['hidden']);";
    let sql_push =      "SELECT us.service_name, us.tenant, count(*) as push from services s join users_services us on s.name = us.service_name and s.tenant = us.tenant where us.channels like '%push%' and not (tags @> ARRAY['hidden']) group by us.service_name, us.tenant;";
    let sql_email =     "SELECT us.service_name, us.tenant, count(*) as email from services s join users_services us on s.name = us.service_name and s.tenant = us.tenant where us.channels like '%email%' and not (tags @> ARRAY['hidden']) group by us.service_name, us.tenant;";
    let sql_sms =       "SELECT us.service_name, us.tenant, count(*) as sms from services s join users_services us on s.name = us.service_name and s.tenant = us.tenant where us.channels like '%sms%' and not (tags @> ARRAY['hidden']) group by us.service_name, us.tenant;";
    let sql_mex =       "SELECT us.service_name, us.tenant, count(*) as mex from services s join users_services us on s.name = us.service_name and s.tenant = us.tenant where not (tags @> ARRAY['hidden']) group by us.service_name, us.tenant;";

    try {
        var result_users = await multiple_db.preferences.execute(sql_services + sql_push + sql_email + sql_sms + sql_mex);
    } catch(err) {
        return next({type: "db_error", status: 500, message: err});
    }

    let result = {};

    result_users[0].forEach( e => {
        result[e.tenant + "|" + e.name] = {
            service_name: e.name,
            tenant: e.tenant,
            push :0,
            email: 0,
            sms: 0,
            mex: 0
        }
    });

    let push = result_users[1];
    push = push.reduce((r,e) => {
        r[e.tenant + "|" + e.service_name] = e.push;
        return r;
    },{});

    let email = result_users[2];
    email = email.reduce((r,e) => {
        r[e.tenant + "|" + e.service_name] = e.email;
        return r;
    },{});

    let sms = result_users[3];
    sms = sms.reduce((r,e) => {
        r[e.tenant + "|" + e.service_name] = e.sms;
        return r;
    },{});


    let mex = result_users[4];
    mex = mex.reduce((r,e) => {
        r[e.tenant + "|" + e.service_name] = e.mex;
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

router.get('/users/_page', async function(req, res, next) {

    logger.debug("called GET /preferences/users/_page, filter:", req.query.filter);

    let filter = JSON.parse(req.query.filter);
    if(filter['u.user_id'] && filter['u.user_id'].eq.length < 32) filter['u.user_id'].eq = utility.hashMD5(filter['u.user_id'].eq);

    try{
        var sql_count = buildQuery.select().table("users as u").join().table("users_services as us").on("u.user_id=us.user_id AND u.tenant=us.tenant")
            .filter(filter).count().sql;
        var sql_filtered = buildQuery.select(" u.*").table("users as u").join().table("users_services as us").on("u.user_id=us.user_id AND u.tenant=us.tenant")
            .filter(filter).sort(req.query.sort).page(req.query.limit, req.query.offset).sql;
        
        logger.debug("sql count users:", sql_count);
        logger.debug("sql get filtered users:", sql_filtered);

        var resultCount = await multiple_db.preferences.execute(sql_count);
        var resultQuery = await multiple_db.preferences.execute(sql_filtered);
        var result = {
            list: resultQuery,
            current_page: Math.round(req.query.offset / req.query.limit) + 1,
            total_pages: Math.ceil((resultCount[0].count) / req.query.limit),
            page_size: req.query.limit,
            total_elements: resultCount[0].count
        };
        return next({type: "ok", status: 200, message: result});
    } catch(e) {
        logger.error(JSON.stringify(e));
        return next({type: "db_error", status: 500, message: e});
    }
});

router.get('/terms', async function(req,res,next) {

    logger.debug("called GET /preferences/terms, query params: user_id[%s], tenant[%s]", req.query.user_id, req.query.tenant);

    let query = "SELECT * from users_terms WHERE user_id='" + req.query.user_id +"' and tenant = '" + req.query.tenant + "';";
    let queryHistory = "select * from users_terms_s WHERE user_id='" + req.query.user_id +"' and tenant = '" + req.query.tenant + "' ORDER by accepted_at DESC";

    logger.debug("sql get user's terms:", query);
    logger.debug("sql get user's terms history", queryHistory);

    try {
        let result = await multiple_db.preferences.execute(query + queryHistory);
        let terms = {};
        terms.terms = result[0][0];
        terms.history_terms = result[1];
        return next({type: "ok", status: 200, message: terms});
    } catch(e) {
        return next({type: "db_error", status: 500, message: e});
    }
});

router.get('/users/count', async function(req, res, next) {

    logger.debug("called GET /preferences/users/count");

    let query = "SELECT count(*) as count from users";
    try {
        let count = await multiple_db.preferences.execute(query);
        return next({type: "ok", status: 200, message: count[0]});
    } catch(e) {
        return next({type: "db_error", status: 500, message: e});
    }
});

module.exports = router;

var getSubscriptionsFeedRunning = false;
async function getSubscriptionsFeed() {
    if(getSubscriptionsFeedRunning) {
        logger.debug("get subscriptions feed process is already running");
        return;
    }
    getSubscriptionsFeedRunning = true;

    // get subscriptions feed enabled services
    try {
        let getServicesListSql = "select preference_service_name, tenant from unpadmin.clients where subscriptions_feed_enabled = true";
        var getServicesList = await multiple_db.unpadmin.execute(getServicesListSql);
    } catch(e) {
        getSubscriptionsFeedRunning = false;
        logger.error(JSON.stringify(e));
        return;
    }

    // process each service
    logger.debug("get services list:", getServicesList);
    for(let service of getServicesList) {
        logger.debug("service: %s", service.preference_service_name);

        try {
            // get service's last update date
            let getServiceStatusSql = "select to_char(last_update_date, 'YYYY-MM-DD') as last_update_date from unppreferences.ioapp_subscriptions_feed_status where service_name = '" 
                + service.preference_service_name + "' and tenant ='" + service.tenant + "'";
            var getServiceStatus = await multiple_db.preferences.execute(getServiceStatusSql);
            logger.debug("service status response:", getServiceStatus);

            var lastUpdateDate = null;
            if(getServiceStatus && getServiceStatus.length > 0)
                // lastUpdateDate = Date.parse(getServiceStatus[0].last_update_date);
                lastUpdateDate = getServiceStatus[0].last_update_date;
            else
                // lastUpdateDate = Date.parse(conf.ioapp_subscriptions_feed.initial_date);
                lastUpdateDate = conf.ioapp.subscriptions_feed.initial_date;
            logger.debug("last update date parsed:", lastUpdateDate);

            let serviceLastUpdateDate = new Date(lastUpdateDate);
            serviceLastUpdateDate.setUTCHours(12);
            serviceLastUpdateDate.setUTCMinutes(0, 0, 0);  
            let yesterday = new Date();
            yesterday.setUTCHours(12);
            yesterday.setUTCMinutes(0, 0, 0);  
            yesterday.setDate(yesterday.getDate() - 1);
            logger.debug("Days to check: from %s to %s", serviceLastUpdateDate.toISOString(), yesterday.toISOString());

            //get service's api key
            let serviceApiKey = await getServiceApiKey(service.preference_service_name, service.tenant);
            logger.debug("service [%s] ioapp api key [%s]", service.preference_service_name, serviceApiKey);
            if(!serviceApiKey) {
                logger.error("no ioapp api key found for service [%s]", service.preference_service_name);
                continue;
            }

            while(serviceLastUpdateDate.getTime() <= yesterday.getTime()) {
                logger.debug("checking subscriptions for day %s", serviceLastUpdateDate.toISOString());

                // invoke subscriptions feed api for the day
                let ioappGetServiceSubscriptions = await axios({
                    method: 'get',
                    url: conf.ioapp.api.base_url + '/subscriptions-feed/' + serviceLastUpdateDate.toISOString().split('T')[0],
                    headers: {
                      'Ocp-Apim-Subscription-Key': serviceApiKey
                    },
                    responseType: 'json',
                });
                logger.debug("subscriptions feed response: subscriptions #[%s] - unsubscriptions #[%s]", ioappGetServiceSubscriptions.data.subscriptions.length, ioappGetServiceSubscriptions.data.unsubscriptions.length);

                // insert/delete subscriptions feed
                
                // handle unsubscriptions
                let unsubscriptionsSql = "";
                for (let index = 0; index < ioappGetServiceSubscriptions.data.unsubscriptions.length; index++) {
                    let unsubscription = ioappGetServiceSubscriptions.data.unsubscriptions[index];
                    unsubscriptionsSql += "delete from ioapp_subscriptions_feed where tenant = '" + service.tenant + "' and service_name = '" +
                        service.preference_service_name + "' and subscriber = '" + unsubscription + "';";
                    
                    if(((index+1)%1000 == 0) || (index+1 == ioappGetServiceSubscriptions.data.unsubscriptions.length)) {
                        let unsubscriptionsQuery = await multiple_db.preferences.execute(unsubscriptionsSql);
                        logger.debug("deleted subscriptions, index [%s]", index+1);
                        unsubscriptionsSql = "";
                    }
                }

                // handle subscriptions
                let subscriptionsSql = "";
                for (let index = 0; index < ioappGetServiceSubscriptions.data.subscriptions.length; index++) {
                    let subscription = ioappGetServiceSubscriptions.data.subscriptions[index];
                    subscriptionsSql += "insert into ioapp_subscriptions_feed (id, tenant, service_name, subscriber)" + 
                        " values ('" + uuidv4() + "', '" + service.tenant + "', '" + service.preference_service_name + "', '" + subscription + "')" +
                        " ON CONFLICT ON CONSTRAINT unique_ioapp_subs_feed_tenant_service_subscriber DO NOTHING;";
                    
                    if(((index+1)%1000 == 0) || (index+1 == ioappGetServiceSubscriptions.data.subscriptions.length)) {
                        let subscriptionsQuery = await multiple_db.preferences.execute(subscriptionsSql);
                        logger.debug("inserted subscriptions, index [%s]", index+1);
                        subscriptionsSql = "";
                    }
                }

                // move to the next day to check
                serviceLastUpdateDate.setDate(serviceLastUpdateDate.getDate() + 1);
                serviceLastUpdateDate.setUTCHours(12);
                serviceLastUpdateDate.setUTCMinutes(0, 0, 0);

                // update service's last update date
                let insertServiceStatusSql = "insert into unppreferences.ioapp_subscriptions_feed_status (id, tenant, service_name, last_update_date) " +
                    "values ('" + uuidv4() + "', '" + service.tenant + "', '" + service.preference_service_name + "', '" + serviceLastUpdateDate.toISOString() + "')";
                insertServiceStatusSql += " ON CONFLICT ON CONSTRAINT ioappsubsfeedstatus_tenant_servicename_unique DO ";
                insertServiceStatusSql += "update set last_update_date = '" + serviceLastUpdateDate.toISOString() + "'";
                
                logger.debug("update service status sql:", insertServiceStatusSql);
                var updateServiceStatus = await multiple_db.preferences.execute(insertServiceStatusSql);
                logger.debug("updated service status");
            }
        } catch(e) {
            logger.error("error processing subscriptions feed for service [%s] tenant [%s]", service.preference_service_name, service.tenant, e);
        }
    }

    getSubscriptionsFeedRunning = false;
    logger.debug("get subscriptions feed process completed");
}
// getSubscriptionsFeed();

let hostname = os.hostname();
if(conf.monitoring.masterhosts.includes(hostname)) {
    logger.debug("scheduling preferences jobs");
    var getSubscriptionsFeedJob = schedule.scheduleJob('0 3 * * *', getSubscriptionsFeed);
}

async function getServiceApiKey(serviceName, tenant) {
    // get service token
    let getServiceTokenSql = "SELECT token_notify FROM unpadmin.clients where preference_service_name = '" + serviceName + "' and tenant = '" + tenant + "'";
    var getServiceToken = await multiple_db.unpadmin.execute(getServiceTokenSql);
    logger.debug("service token result:", getServiceToken);

    // decrypt service token
    let decryptedToken = utility.checkNested(conf,"security.crypto.password")? cryptoAES_cbc.decrypt(getServiceToken[0].token_notify, conf.security.crypto.password): getServiceToken[0].token_notify;
    let serviceJwtToken = jwt.decode(decryptedToken);
    logger.debug("decoded token", serviceJwtToken);

    // return service api key
    return serviceJwtToken.preferences && serviceJwtToken.preferences.io? serviceJwtToken.preferences.io : null;
}