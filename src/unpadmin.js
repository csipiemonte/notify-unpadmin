var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/unp-admin'), require('./conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const multiple_db = obj.multiple_db();
const logger = obj.logger();

var path = require('path');

var express = require('express');
var session = require('express-session');
var app = express();

var util = require("util");
var bodyParser = require('body-parser');
app.use(bodyParser.json());

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport(conf.mail.server);
transporter.sendMail = util.promisify(transporter.sendMail);

var checkSecurity = require("./utilities/security_checks")(logger);

const fs = require("fs");

app.use(session({
    secret: 'ssshhhhh',
    resave: false,
    saveUninitialized: true,
}));

if(obj.security) app.use(async function(req,res,next) {
    if(!commons.hasOwnNestedProperty(conf,"security.shibboleth") || req.session.shib_user) return next();

    let cf = req.get("Shib-Identita-CodiceFiscale");
    let name = req.get("Shib-Identita-Nome");
    let surname = req.get("Shib-Identita-Cognome");

    try {
        let result = await multiple_db.unpadmin.execute("SELECT * FROM users_permissions " +
            "WHERE cf='" + cf + "'");
        if(!result[0] || result[0] === null || result[0].length === 0) throw "user '" + cf + "' not authorized";
        let user = result[0];
        req.session.shib_user = {
            fiscal_code: cf,
            name: name,
            surname: surname,
            logout_url: conf.security.shibboleth.logout,
            roles: user.roles
        }
        return next();
    } catch(e) {
        return next({type: "security_error", status: 401, message: e});
    }
});

var dashboardController = require("./controller/dashboard-controller");
var clientsController = require("./controller/clients-controller");
var auditController = require("./controller/audit-controller");
var eventsController = require("./controller/events-controller");
var reportExcelController = require("./controller/report-excel-controller");
var reportCsvController = require("./controller/report-csv-controller");
var mexController = require("./controller/mex-controller");
var preferencesController = require("./controller/preferences-controller");
var events_messagesController = require("./controller/events_messages-controller");
var check_statusController = require("./controller/check-status-controller");
var tokenController = require("./controller/token-controller");
var statisticController = require("./controller/statistic-controller");
var usersPermissionsController = require("./controller/users-permissions-controller");
var redisController = require("./controller/redis-controller");
var tagsController = require("./controller/tags-controller");
var tenantsController = require("./controller/tenants-controller");

var prefix = "/api/v1";
app.use(prefix + "/dashboard",(req,res,next) => checkSecurity.checkOperation(req,res,next));
app.use(prefix + "/clients",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/preferences",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/audit",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/events",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/report",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/messages",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/messages_events",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/status",(req,res,next) => checkSecurity.checkOperation(req,res,next));
app.use(prefix + "/status/redis/queues/:queue_name",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/token",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/statistic",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/user-permissions",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/redis",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/tags",(req,res,next) => checkSecurity.checkAdmin(req,res,next));
app.use(prefix + "/tenants",(req,res,next) => checkSecurity.checkAdmin(req,res,next));

app.use(prefix + "/dashboard", dashboardController);
app.use(prefix + "/clients", clientsController);
app.use(prefix + "/preferences", preferencesController);
app.use(prefix + "/audit", auditController);
app.use(prefix + "/events", eventsController);
app.use(prefix + "/report/excel", reportExcelController);
app.use(prefix + "/report/csv", reportCsvController);
app.use(prefix + "/messages", mexController);
app.use(prefix + "/messages_events", events_messagesController);
app.use(prefix + "/status", check_statusController);
app.use(prefix + "/token", tokenController);
app.use(prefix + "/statistic", statisticController);
app.use(prefix + "/users-permissions", usersPermissionsController);
app.use(prefix + "/redis", redisController);
app.use(prefix + "/tags", tagsController);
app.use(prefix + "/tenants", tenantsController);
app.use('/', express.static(path.join(__dirname, 'web')));

app.get(prefix + '/environment_variables', async function (req, res,next) {
    let env = {};
    env.ENVIRONMENT = process.env.ENVIRONMENT || "localhost";
    return next({type: "ok", status: 200, message: env});
});

app.get(prefix + '/user', async function (req, res,next) {
    return next({type: "ok", status: 200, message: req.session.shib_user});
});

app.post(prefix + '/user/logout', async function (req, res,next) {
    logger.debug("user logged out");
    delete req.session.shib_user;
    return next({type: "ok", status: 200, message: req.session.shib_user});
});

app.post(prefix + '/mail/send', async function (req, res,next) {
    logger.debug("trying to send email: ",req.body);
    let mail = req.body;

    try {
        let mailOptions = {
            from: mail.sender,
            to: mail.recipient,
            cc: mail.cc,
            subject: mail.subject,
            text: mail.body
        };
        await transporter.sendMail(mailOptions);
        logger.debug("email sent");
        return next({type: "ok", status: 200, message: "Email sent"});
    } catch(e) {
        logger.error("Error sending mail: ", JSON.stringify(e));
        return next({type: "system_error", status: 500, message: e});
    }
});

app.get(prefix + '/destinatari', async function (req, res,next) {
    logger.debug("called get destinatari");
    try {
        let destinatari = await fs.readFileSync(process.env.destinatari,'utf8');
        return next({type: "ok", status: 200, message: destinatari.split("\n")});
    } catch(e) {
        logger.error("email recipients file does not exist:", JSON.stringify(e));
        return next({type: "system_error", status: 500, message: e});
    }
});

obj.response_handler(app);

app.listen(conf.server_port, function () {
    logger.info("environment:", JSON.stringify(process.env, null, 4));
    logger.info("configuration:", JSON.stringify(conf, null, 4));
    logger.info('Express server listening on port:', conf.server_port);
});
