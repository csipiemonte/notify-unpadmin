var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();
const buildQuery = obj.query_builder();

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

const fs = require("fs");

const dateformat = require("dateformat");

var util = require("util");

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport(conf.mail.server);
transporter.sendMail = util.promisify(transporter.sendMail);

router.use(bodyParser.json());


router.get('/stats', async function (req, res, next) {

    logger.debug("/stats" + req.query.filter);


    try{
        var sql = buildQuery.select("sender, source, type, sum(counter) as counter").table('stats')
            .filter(req.query.filter).groupBy("sender, source, type").sql;
    }catch (err){
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await multiple_db.events.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: result});
});


router.post('/historicize', async function (req, res, next) {
        logger.debug("called stats/historicize ", req.body);
        let stat = req.body;
        let values = {
            sender: stat.sender,
            source: stat.source,
            type: "OLD_SYSTEM_ERROR",
            counter: stat.SYSTEM_ERROR
        };

        try{

            let addOldSE = "INSERT INTO stats select sender,date," +
                "source,'OLD_SYSTEM_ERROR',counter from stats sel_stat WHERE sender='" + stat.sender +
                      "' and type='SYSTEM_ERROR' and source='" + stat.source + "' and date between " + stat.date.gte + " and " + stat.date.lte
                + " ON DUPLICATE KEY UPDATE stats.counter = stats.counter + sel_stat.counter";
            let resetSE = "update stats set counter = 0 where sender='" + stat.sender + "' and date between " + stat.date.gte + " and " + stat.date.lte +
                " and source='" + stat.source + "' and type='SYSTEM_ERROR'";
            await multiple_db.events.execute(addOldSE +";"+resetSE);

            const NOTIFIED_SERVICE_PATH = '../../commons/src/alert/notified_service.txt';
            var notified_service = await fs.readFileSync(NOTIFIED_SERVICE_PATH,'utf8').toString().split("\n").filter( serv => serv !== stat.sender);
            await fs.truncateSync(NOTIFIED_SERVICE_PATH);
            await fs.writeFileSync(NOTIFIED_SERVICE_PATH,notified_service.join("\n"));
            return next({type: "ok", status: 200});
        }catch(err){
            logger.error(err);
            return next({type: "db_error", status: 500, message: err});
        }

});

module.exports = router;
