var fs = require('fs');
const req_promise = require("util").promisify(require("request"));

var mb_url = "http://localhost:8080/api/v1/topics/messages";
var token = "xxxx";

console.log(mb_url);
console.log(token);
run();

async function run(){
  var mexs = fs.readFileSync("dati.json");
  mexs = JSON.parse(mexs);
  console.log("mexs size : " + mexs.length);
  mexs = await prepareMessages(mexs,20000000);
  console.log("messages prepared: " + mexs.length + " chunks")
  await sendMessages(mexs,token);
  console.log("end");
}

async function sendMessages(mexs,token){
    console.log("trying to send messages to mb");
    for(let i=0;i<mexs.length;i++){
      await sendMessage(mexs[i],token);
    }
    console.log("mexs sent");
  }
  
  async function prepareMessages(mexs,limit){
      console.log("prepare bulks");
      if(!Array.isArray(mexs[0])) mexs = [mexs];
      if (mexs.every( e => JSON.stringify(e).length < limit)) return mexs;
  
      let temp = [];
      mexs = mexs.map( chunk => {
        if(JSON.stringify(chunk).length < limit) {
          return chunk;
        }
        temp.push(chunk.slice(0, Math.ceil(chunk.length / 2)));
        temp.push(chunk.slice(Math.ceil(chunk.length / 2), chunk.length ));
        return null;
      } ).filter(e => e !== null);
  
      mexs = mexs.concat(temp);
      return prepareMessages(mexs,limit);
  }
  
  async function sendMessage(mexs,token){
    console.log("sending messages");
    var options = {
            url: mb_url,
            method: 'POST',
            headers: {
                'x-authentication': token
            },
            body: mexs,
            json: true
        }
    try{
        let response = await req_promise(options);
        console.log("mex sent");
    }catch(e){
        console.log(e);
        throw e;
    }
}
