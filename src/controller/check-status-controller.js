var commons = require("../../../commons/src/commons");
const conf = commons.merge(require('../conf/unp-admin'), require('../conf/unp-admin-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
const logger = obj.logger();
const exec = require('child_process').exec;
const util = require('util');
const Redis = require("ioredis");
const redis = new Redis(conf.redis);
const fs = require("fs");

var ssh_exec = require('node-ssh-exec');
const shellParser = require('node-shell-parser');
var datetime = require('node-datetime');

const prom_exec = util.promisify(exec);

var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');

var requestPromise = require('request-promise-native');

router.use(bodyParser.json());

redis.defineCommand("ldelete", {
  numberOfKeys: 0,
  lua: fs.readFileSync('controller/lua-script/ldelete.lua')
});

redis.defineCommand("getmessage", {
  numberOfKeys: 0,
  lua: fs.readFileSync('controller/lua-script/get-message.lua')
});

redis.defineCommand("gethmunpacked", {
  numberOfKeys: 0,
  lua: fs.readFileSync('controller/lua-script/get-hm-unpacked.lua')
});

redis.defineCommand("ldeletebyid", {
  numberOfKeys: 0,
  lua: fs.readFileSync('controller/lua-script/ldeletebyid.lua')
});

router.get('/status-processes-host', async function(req, res, next) {
  logger.debug("called status-processes-host");

  var execute_process = exec("cd " + process.cwd() + '/status-machines/ && bash ./check-status-processes',
    (error, stdout, stderr) => {
      logger.trace("ssh exec result: error[%s], stdout[%s], stderr[%s]", error, stdout, stderr);
      if (error !== null) {
        return next({
          type: "system_error",
          status: 500,
          message: {
            "error": error,
            "detail": stderr
          }
        });
      }

      let result = JSON.parse(stdout);
      delete result[""];

      next({
        type: "ok",
        status: 200,
        message: result
      });
    });

});

const SECURITY_ADMIN = "security.admin_user";

router.get('/monitor', async function(req, res, next) {
  logger.debug("called monitor");

  let hosts = conf.monitoring.hosts;

  let url = "http://{{host}}:" + conf.server_port + "/api/v1/status/status-processes-host";

  try {
    let res = await Promise.all(hosts.map(async function(host) {
      try {
        return await requestPromise({
          headers: {
            'Shib-Identita-CodiceFiscale': commons.hasOwnNestedProperty(conf, SECURITY_ADMIN) ? conf.security.admin_user.user : ""
          },
          url: url.replace("{{host}}", host),
          method: 'GET',
          json: true
        });
      } catch (e) {
        logger.error("Error in connection [%s]: %s", url, e.message);
        return {};
      }
    }));

    let r = {};
    for (let i = 0; i < hosts.length; i++) {
      r[hosts[i]] = res[i];
    }

    next({
      type: "ok",
      status: 200,
      message: r
    });
  } catch (e) {
    logger.error("Error in /monitor: %s", JSON.stringify(e));
    return next({
      type: "system_error",
      status: 500,
      message: "error"
    });
  }

});

router.get('/monitor-mb', async function(req, res, next) {
  logger.debug("called monitor-mb");

  let hosts = conf.monitoring.mbhosts;

  let url = "http://{{host}}:" + conf.server_port + "/api/v1/status/status-processes-host";

  try {
    let res = await Promise.all(hosts.map(async function(host) {
      try {
        return await requestPromise({
          headers: {
            'Shib-Identita-CodiceFiscale': commons.hasOwnNestedProperty(conf, SECURITY_ADMIN) ? conf.security.admin_user.user : ""
          },
          url: url.replace("{{host}}", host),
          method: 'GET',
          json: true
        });
      } catch (e) {
        logger.error("Error in connection [%s]: %s", url, e.message);
        return {};
      }
    }));

    let r = {};
    for (let i = 0; i < hosts.length; i++) {
      r[hosts[i]] = res[i];
    }

    next({
      type: "ok",
      status: 200,
      message: r
    });
  } catch (e) {
    logger.error("Error in /monitor-mb: %s", JSON.stringify(e));
    return next({
      type: "system_error",
      status: 500,
      message: "error"
    });
  }

});

router.post('/host/:host/processes/:operation', async function(req, res, next) {

  let host = req.params.host;
  let operation = req.params.operation;
  let processes = req.query.processes.split(",");
  logger.debug("called status/host/" + req.params.host + "/processes/" + req.params.operation + " with processes: " + processes);


  for (let process of processes) {
    let options = {
      headers: {
        'Shib-Identita-CodiceFiscale': commons.hasOwnNestedProperty(conf, SECURITY_ADMIN) ? conf.security.admin_user.user : ""
      },
      url: "http://" + host + ":" + conf.server_port + "/api/v1/status/" + operation + "/" + process,
      method: 'POST',
      json: true
    };

    try {
      let res = await requestPromise(options);
    } catch (e) {
      logger.error(JSON.stringify(e));
      return next({
        type: "system_error",
        status: 500,
        message: e
      });
    }
  }

  logger.debug("executed all request");
  return next({
    type: "ok",
    status: 200
  });

});

router.post('/host/:host/pm2/:operation', async function(req, res, next) {

  let host = req.params.host;
  let operation = req.params.operation;
  logger.debug("called status/host/" + host + "/pm2/" + operation);

  var config = {
      host: host,
      username: "unp",
      password: "unp"
    },
    command = 'pm2 ' + operation + ' $HOME/notify/notify-ecosystem.config.js';

  ssh_exec(config, command, function(error, response) {
    if (error) {
      logger.error("ssh_exec error: ", error);
      return next({
        type: "system_error",
        status: 500,
        message: {
          "error": error
        }
      });
    }
  });

  logger.debug("executed pm2 request");
  return next({
    type: "ok",
    status: 200
  });

});

router.post('/hosts/:process/:operation', async function(req, res, next) {

  let hosts = req.query.hosts.split(",");
  let operation = req.params.operation;
  let process = req.params.process;
  logger.debug("called status/hosts/" + req.params.process + "/" + req.params.operation + " with hosts: " + hosts);


  for (let host of hosts) {
    let options = {
      headers: {
        'Shib-Identita-CodiceFiscale': commons.hasOwnNestedProperty(conf, SECURITY_ADMIN) ? conf.security.admin_user.user : ""
      },
      url: "http://" + host + ":" + conf.server_port + "/api/v1/status/" + operation + "/" + process,
      method: 'POST',
      json: true
    };

    try {
      let res = await requestPromise(options);
    } catch (e) {
      logger.error(JSON.stringify(e));
      return next({
        type: "system_error",
        status: 500,
        message: e
      });
    }
  }

  logger.debug("executed all request");
  return next({
    type: "ok",
    status: 200
  });

});

router.post('/host/:host/:operation/:process', async function(req, res, next) {

  let host = req.params.host;
  logger.debug("called status/host/" + host + "/" + req.params.operation + "/" + req.params.process);

  var options = {
    headers: {
      'Shib-Identita-CodiceFiscale': commons.hasOwnNestedProperty(conf, SECURITY_ADMIN) ? conf.security.admin_user.user : ""
    },
    url: "http://" + host + ":" + conf.server_port + "/api/v1/status/" + req.params.operation + "/" + req.params.process,
    method: 'POST',
    json: true
  };

  try {
    let res = await requestPromise(options);

    next({
      type: "ok",
      status: 200
    });
  } catch (e) {
    logger.error(JSON.stringify(e));
    return next({
      type: "system_error",
      status: 500,
      message: e
    });
  }

});

router.post('/:operation/:process', async function(req, res, next) {

  logger.debug("called status/" + req.params.operation + "/" + req.params.process);
  let cmd = '';
  cmd = "cd " + process.cwd() + '/status-machines/ && bash ./unp-process ' + req.params.operation + " " + req.params.process;
  logger.debug("cmd: ", cmd);
  try {
    var result = await prom_exec(cmd);

    logger.trace("ssh exec result: %s", result);

    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (e) {
    return next({
      type: "system_error",
      status: 500,
      message: {
        "error": e
      }
    });
  }

});

router.get('/redis/info', async function(req, res, next) {

  try {

    let result = await redis.info();
    result = result.split("\r\n").filter(e => e.indexOf(":") !== -1).map(e => {
      let r = {};
      r[e.split(":")[0]] = e.split(":")[1];
      return r;
    }).reduce((r, e) => {
      r[Object.keys(e)[0]] = e[Object.keys(e)[0]];
      return r;
    }, {});
    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }

});

router.get('/process/:pid/status', async function(req, res, next) {

  let pid = req.params.pid;
  let server = req.query.host;
  logger.debug("called process/" + pid + "/status with host:", server);

  let host = server;

  var config = {
      host: host,
      username: "unp",
      password: "unp"
    },
    command = "ps aux | grep '" + pid + "\\|USER' | grep -v 'grep'";

  ssh_exec(config, command, function(error, response) {
    if (error) {
      logger.error("ssh_exec error: ", error);
      return next({
        type: "system_error",
        status: 500,
        message: {
          "error": error
        }
      });
    }

    command = "ps -o etimes= -p " + pid;
    ssh_exec(config, command, function(error, etimes) {
      if (error) {
        logger.error("ssh_exec error: ", error);
        return next({
          type: "system_error",
          status: 500,
          message: {
            "error": error
          }
        });
      }

      logger.debug("etimes: ", etimes);
      logger.debug("response: ", response);

      let process = shellParser(response)[0];
      if (typeof process !== 'object') return next({
        type: "system_error",
        status: 500,
        message: "response from script is not a json"
      });
      logger.debug("process parsed: ", JSON.stringify(process, null, 4));

      process.PID = (process.USER.match(/[0-9]+/g) || "") + process.PID + "";
      process.USER = process.USER.match(/[A-Za-z]+/g) + "";
      let memVszSplitted = process['%MEM'].split(" ");
      if (memVszSplitted.length > 1) {
        process['%MEM'] = memVszSplitted[0];
        process['VSZ'] = memVszSplitted[1] + process.VSZ;
      }
      let VSZRSSSplitted = process.VSZ.split(" ");
      if (VSZRSSSplitted.length > 1) {
        process.VSZ = VSZRSSSplitted[0];
        process.RSS = VSZRSSSplitted[1] + process.RSS;
      }
      process.memory_usage = parseInt(process.RSS / 1024) + "M";
      
      var days = Math.floor(etimes / (3600 * 24));
      var hours = Math.floor(etimes % (3600 * 24) / 3600);
      var minutes = Math.floor(etimes % 3600 / 60);
      var seconds = Math.floor(etimes % 60);

      process.uptime = days + "d " + hours + "h " + minutes + "m " + seconds + "s";
      return next({
        type: "ok",
        status: 200,
        message: process
      });
    });

  });
});

router.get('/:host/status', async function(req, res, next) {
  //return next({type: "ok", status: 200, message: {"memory":{"mem":{"total":"3952","used":"511","free":"1857","shared":"200","buff/cache":"1583","available":"2872"},"swap":{"total":"2047","used":"16","free":"2031","shared":"","buff/cache":"","available":""}},"disk":[{"Filesystem":"/dev/mapper/centos-root","Size":"5.0G","Used":"349M","Avail":"4.7G","Use%":"7%","Mounted":"/","on":""},{"Filesystem":"devtmpfs","Size":"2.0G","Used":"0","Avail":"2.0G","Use%":"0%","Mounted":"/dev","on":""},{"Filesystem":"tmpfs","Size":"2.0G","Used":"0","Avail":"2.0G","Use%":"0%","Mounted":"/dev/shm","on":""},{"Filesystem":"tmpfs","Size":"2.0G","Used":"201M","Avail":"1.8G","Use%":"11%","Mounted":"/run","on":""},{"Filesystem":"tmpfs","Size":"2.0G","Used":"0","Avail":"2.0G","Use%":"0%","Mounted":"/sys/fs/","on":"cgroup"},{"Filesystem":"/dev/mapper/centos-usr","Size":"3.0G","Used":"1.5G","Avail":"1.6G","Use%":"48%","Mounted":"/usr","on":""},{"Filesystem":"/dev/sda1","Size":"488M","Used":"122M","Avail":"331M","Use%":"27%","Mounted":"/boot","on":""},{"Filesystem":"/dev/mapper/centos-tmp     1","Size":"014M","Used":"34M","Avail":"981M","Use%":"4%","Mounted":"/tmp","on":""},{"Filesystem":"/dev/mapper/centos-var","Size":"3.0G","Used":"533M","Avail":"2.5G","Use%":"18%","Mounted":"/var","on":""},{"Filesystem":"/dev/mapper/centos-appserv","Size":"8.0G","Used":"1.1G","Avail":"7.0G","Use%":"13%","Mounted":"/appserv","on":""},{"Filesystem":"/dev/mapper/centos-home    1","Size":"014M","Used":"33M","Avail":"982M","Use%":"4%","Mounted":"/home","on":""},{"Filesystem":"tmpfs","Size":"396M","Used":"0","Avail":"396M","Use%":"0%","Mounted":"/run/use","on":"r/1000"},{"Filesystem":"tmpfs","Size":"396M","Used":"0","Avail":"396M","Use%":"0%","Mounted":"/run/use","on":"r/0"},{"Filesystem":"tmpfs","Size":"396M","Used":"0","Avail":"396M","Use%":"0%","Mounted":"/run/use","on":"r/1002"}]} });

  let host = req.params.host;
  logger.debug("called status/" + host + "/status");

  let config = {
    host: host,
    username: "unp",
    password: "unp"
  };

  let commands = [{
      parameter: "memory",
      command: "free -m",
      parse_result_function: function(response) {
        var final_result = {};
        final_result.mem = response[0];
        final_result.swap = response[1];

        final_result.mem.total = final_result.mem.total.match(/[0-9]+/g)[0];
        final_result.swap.total = final_result.swap.total.match(/[0-9]+/g)[0];

        return final_result;
      }
    },
    {
      parameter: "disk",
      command: "df -h"
    }
  ];

  let ssh_exec_prom = util.promisify(ssh_exec);

  var total_result = {};

  for (var command of commands) {
    try {
      let response = await ssh_exec_prom(config, command.command);
      let result = command.parse_result_function ? command.parse_result_function(shellParser(response)) : shellParser(response);
      total_result[command.parameter] = result;
    } catch (error) {
      logger.error(JSON.stringify(error));
      return next({
        type: "system_error",
        status: 500,
        message: {
          "error": error
        }
      });
    }
  }

  logger.debug("commmands: ", JSON.stringify(total_result, null, 4))
  return next({
    type: "ok",
    status: 200,
    message: total_result
  });

});

router.get('/redis/queues', async function(req, res, next) {
  let queues = {
    "mb:queues:events:events":1,
    "mb:queues:messages:mex":1,
    "mb:queues:messages:sms":1,
    "mb:queues:messages:email":1,
    "mb:queues:messages:push":1,
    "mb:queues:messages:io":1,
    "mb:queues:audit:audit":1,
    "mb:queues:events:events:dead":1,
    "mb:queues:messages:mex:dead":1,
    "mb:queues:messages:sms:dead":1,
    "mb:queues:messages:email:dead":1,
    "mb:queues:messages:push:dead":1,
    "mb:queues:messages:io:dead":1,
    "mb:queues:audit:audit:dead":1,
  }

  Object.keys(queues).filter(k => !k.includes("dead")).forEach( k => queues[k + "_priority"] = 0);
  Object.keys(queues).filter(k => !k.includes("priority") && !k.includes("dead")).forEach( k => queues[k + "_bulk"] = 100);
  Object.keys(queues).filter(k => !k.includes("bulk") && !k.includes("dead")).forEach( k => k.includes("priority")? queues[k + ":to_be_retried"] = 0:queues[k + ":to_be_retried"] = 1);
  
  try {
    var result = {};
    await Promise.all(Object.keys(queues).map(async function(queue) {
      let zcount = await redis.zcount(queue.replace("_priority", "").replace("_bulk", ""), queues[queue], queues[queue]);
      result[queue] = zcount;
      return result;
    }));

    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.get('/redis/queues/:queue_name', async function(req, res, next) {
  logger.debug("/redis/queues/%s", req.params.queue_name);
  try {
    let queue_name = req.params.queue_name.replace("_priority","").replace("_bulk","");
    let score = 1;
    if(req.params.queue_name.includes("priority")) score = 0;
    if(req.params.queue_name.includes("bulk")) score = 100;
    let result = await redis.getmessage(queue_name, 100, score);
    logger.debug("queues response: ", result);
    
    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.get('/redis/hm', async function(req, res, next) {
  let queues = ["mb:coda:queues:messages", "mb:counter:queues:messages", "mb:coda:queues:messages:dead", "mb:counter:queues:messages:dead", 
  "mb:coda:queues:events:dead", "mb:counter:queues:events:dead","mb:retries:events:events", "mb:retries:messages:mex"];

  try {
    var result = await Promise.all(queues.map(async function(queue) {
      return await redis.gethmunpacked(queue);
    }));
    let r = {};
    for (let i = 0; i < queues.length; i++) {
      try {
        r[queues[i]] = JSON.parse(result[i]);
      } catch (e) {
        r[queues[i]] = result[i];
      }
    }

    return next({
      type: "ok",
      status: 200,
      message: r
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.get('/redis/hm/length', async function(req, res, next) {
  let queues = ["mb:coda:queues:messages", "mb:counter:queues:messages", "mb:coda:queues:messages:dead", "mb:counter:queues:messages:dead",
    "mb:coda:queues:events:dead", "mb:counter:queues:events:dead", "mb:coda:queues:audit:dead", "mb:counter:queues:audit:dead","mb:retries:events:events", "mb:retries:messages:mex", "mb:retries:messages:sms",
    "mb:retries:messages:email", "mb:retries:messages:push", "mb:retries:messages:io", "mb:retries:audit:audit"];

  try {
    var result = await Promise.all(queues.map(async function(queue) {
      return await redis.hlen(queue);
    }));
    let r = {};
    for (let i = 0; i < queues.length; i++) r[queues[i]] = result[i];

    return next({
      type: "ok",
      status: 200,
      message: r
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.get('/redis/keys/:key', async function(req, res, next) {
  logger.debug("called /redis/keys/", req.params.key);
  try {
    let type = await redis.type(req.params.key);
    let result;
    switch (type) {
      case 'hash':
        result = await redis.hgetall(req.params.key);
        break;
      case 'list':
        result = await redis.lrange(req.params.key, 0, -1);
        break;
    }
    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (err) {
    logger.error("error in get key: ", err.message);
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.get('/redis/hm/:queue', async function(req, res, next) {
  logger.debug("called /status/redis/hm");
  let queue = req.params.queue;
  try {
    var result = await redis.gethmunpacked(queue);

    return next({
      type: "ok",
      status: 200,
      message: result
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.delete('/redis/queues/:queue_name/message/:uuid', async function(req, res, next) {
  logger.debug("called DELETE /redis/queues/:queue_name/message");
  let uuid = req.params.uuid;
  let queue_name = req.params.queue_name;

  try {
    let result = await redis.ldelete(queue_name, uuid);
    return next({
      type: "ok",
      status: 200,
      message: result + ""
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

router.delete('/redis/queues/messages/:id', async function(req, res, next) {
  logger.debug("called DELETE /redis/queues/messages/ " + req.params.id);

  try {
    let resultDel = await redis.ldeletebyid(req.params.id);
    return next({
      type: "ok",
      status: 200,
      message: resultDel
    });
  } catch (err) {
    logger.debug(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

module.exports = router;