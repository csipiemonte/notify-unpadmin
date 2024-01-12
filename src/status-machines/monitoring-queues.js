var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
const logger = obj.logger();
const util = require("util");
var redis = new require('ioredis');
redis = new redis(conf.redis);
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport(conf.mail.server);
transporter.sendMail = util.promisify(transporter.sendMail);

var fs = require("fs");

var environment = (process.env.ENVIRONMENT || "localhost").toUpperCase();
const lastMessagePath = "./lastMessage.json";
const oldResultPath = "./oldResult.json";

var lastMessage = {};
var oldResult = {};

initFile();

async function initFile(){
  try{
    lastMessage = JSON.parse(await fs.readFileSync(lastMessagePath));
  }catch(e){
    logger.debug(e);
  }
  try{
    oldResult = JSON.parse(await fs.readFileSync(oldResultPath));
  }catch(e){
    logger.debug(e);
  }
}

var queues = {
    email: "mb:queues:messages:email",
    sms: "mb:queues:messages:sms",
    push: "mb:queues:messages:push",
    mex: "mb:queues:messages:mex",
    io: "mb:queues:messages:io",
    events: "mb:queues:events:events",
    audit: "mb:queues:audit:audit",
}

execute();
async function execute(){
  let result = {};
  for await (const ch of Object.keys(queues)){
      result[ch] = await checkStatus(ch);
  }

  //logger.debug("result: ",result);
  let difference = Object.keys(oldResult).filter(k => oldResult[k] !== result[k]);
  //logger.debug("difference: ",difference);
  try{
      if(difference.length > 0 && Object.values(result).includes(false)){
        logger.info("email sent: ",result);
        await sendMail(environment + " ENVIRONMENT\n\nThese queues are not working: " + Object.keys(result).filter(ch => result[ch] === false).join(",") );
      }
  }catch(e){
    logger.error("email not sent:",e);
  }
  oldResult = result;
  try{
    await writeFile(oldResultPath,JSON.stringify(oldResult));
    process.exit(0);
  }catch(e){
    logger.error(e);
    process.exit(1);
  }

}

async function writeFile(path,content){
  try{
    await fs.writeFileSync(path, content, 'utf8');
  }catch(e){
    throw e;
  }
}
async function checkStatus(ch){
    let queue = queues[ch];
    let uuid = (await redis.zrangebyscore(queue,0,100,'limit',0,1))[0];
    if(!lastMessage[ch]){
      lastMessage[ch] = uuid;
      try{
        await writeFile(lastMessagePath,JSON.stringify(lastMessage));
      }catch(e){
        logger.error(e);
      }
      return true;
    }
    if(uuid === lastMessage[ch]) return false;
    lastMessage[ch] = uuid;
    try{
      await writeFile(lastMessagePath,JSON.stringify(lastMessage));
    }catch(e){
      logger.error(e);
    }
    return true;
}

async function sendMail(text) {
  let destinatari = await fs.readFileSync(process.env.destinatari, 'utf8');
  destinatari = destinatari.split("\n").join(",");
  try {
    let mail = {
      from: "notify@mydomain.it",
      to: destinatari,
      subject: environment + " ENVIRONMENT: check status queus redis",
      text: text
    }
    await transporter.sendMail(mail);
  } catch (e) {
    logger.error(e);
  }
}
