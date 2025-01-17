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

router.get('/overview', async function (req, res,next) {

    logger.debug("called GET dashboard/overview");
    var services_count_sql = buildQuery.select().table('services').count().sql;
    var users_count_sql = buildQuery.select().table('users').count().sql;
    // var messages_count_sql = buildQuery.select().table('messages').count().sql;
    var messages_count_sql = "SELECT reltuples::bigint AS count FROM pg_class WHERE relname = 'messages'";
    // select source, type, sum(counter) as count from stats where date = '20220405' group by source, type order by source
    let today = new Date();
    let filter = today.getFullYear().toString().concat(String(today.getMonth() + 1).padStart(2,'0')).concat(String(today.getDate()).padStart(2,'0'));
    var consumers_today_data_sql = "select source, type, sum(counter) as count from stats where date = '" + filter + "' group by source, type order by source";
    var senders_today_data_sql = "select sender, source, sum(counter) as count from stats where date = '" + filter + "' and type != 'RETRY' group by sender, source order by source ASC, count DESC";
    
    try {
        let message = {};
        
        let preferences_result = await multiple_db.preferences.execute(services_count_sql + ";" + users_count_sql);
        // logger.debug(preferences_result);
        message.services_count = preferences_result[0][0].count;
        message.users_count = preferences_result[1][0].count;

        let messages_result =  await multiple_db.mex.execute(messages_count_sql);
        // logger.debug(messages_result);
        message.messages_count = messages_result[0].count;

        let consumers_data_result = await multiple_db.events.execute(consumers_today_data_sql);
        // logger.debug(consumers_data_result);

        message.consumers = {};
        consumers_data_result.forEach(element => {
            if (!message.consumers[element.source]) message.consumers[element.source] = {};
            if (!message.consumers[element.source].type) message.consumers[element.source].type = [];
            message.consumers[element.source].type.push(element.type);
            if (!message.consumers[element.source].data) message.consumers[element.source].data = [];
            message.consumers[element.source].data.push(element.count);
        });

        let senders_data_result = await multiple_db.events.execute(senders_today_data_sql);
        // logger.debug(senders_data_result);

        message.senders = senders_data_result;

        logger.debug(JSON.stringify(message, null, 4));

        next({type: "ok", status: 200, message: message});
    } catch (err) {
        logger.error(err.message);
        return next({type: "db_error", status: 500, message: err});
    }

});

module.exports = router;

