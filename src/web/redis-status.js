app.controller("redis-status", function ($rootScope,$scope, $http, $interval,$window) {

    function getRedisQueues() {
        $http.get("api/v1/status/redis/queues").then(((reply) => {
            $scope.queues = {};
            $scope.queues["STANDARD"] = {};
            $scope.queues["TO BE RETRIED"] = {};
            $scope.queues["PRIORITY"] = {};
            $scope.queues["PRIORITY TO BE RETRIED"] = {};
            $scope.queues["BULK"] = {};
            Object.keys(reply.data).filter(name => !name.endsWith("to_be_retried") && !name.includes("_priority") && !name.includes("bulk")).forEach(name => $scope.queues["STANDARD"][name] = reply.data[name]);
            Object.keys(reply.data).filter(name => name.endsWith("to_be_retried") && !name.includes("_priority") && !name.includes("bulk")).forEach(name => $scope.queues["TO BE RETRIED"][name] = reply.data[name]);
            Object.keys(reply.data).filter(name => !name.endsWith("to_be_retried") && name.includes("_priority") && !name.includes("bulk")).forEach(name => $scope.queues["PRIORITY"][name] = reply.data[name]);
            Object.keys(reply.data).filter(name => name.endsWith("to_be_retried") && name.includes("_priority") && !name.includes("bulk")).forEach(name => $scope.queues["PRIORITY TO BE RETRIED"][name] = reply.data[name]);
            Object.keys(reply.data).filter(name => name.includes("bulk")).forEach(name => $scope.queues["BULK"][name] = reply.data[name]);
        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error from redis queue: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));
    }

    function getRedisMapLen() {
        $http.get("api/v1/status/redis/hm/length").then(((reply) => {
            $scope.maps = reply.data;
        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error from redis queue: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));
    }

    getRedisQueues();
    getRedisMapLen();
    getRedisInfo();

    function getRedisInfo() {
        $http.get("api/v1/status/redis/info").then(((reply) => {
            $scope.redis_info = reply.data;
        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error from redis status: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));
    }

    var refreshRedisQueues = $interval(getRedisQueues, 1000);
    var refreshRedisHM = $interval(getRedisMapLen, 1000);
    var refreshRedisInfo = $interval(getRedisInfo, 1000);

    $scope.$on('$destroy', function () {
        if (refreshRedisQueues) $interval.cancel(refreshRedisQueues);
        if (refreshRedisInfo) $interval.cancel(refreshRedisInfo);
    });

    $scope.showMessageList = async function (queue_name) {
        $scope.queue_name = queue_name;
        $scope.message_list = (await $http.get("api/v1/status/redis/queues/" + queue_name)).data.map(e => JSON.parse(e));
    }

    $scope.showMap = async function(q){
        $http.get("api/v1/status/redis/hm/" + q).then(((reply) => {
            $scope.hm = reply.data;
        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error from redis queue: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));
    }

    $scope.deleteMex = async function(index,mex){
        if (!confirm("delete message?")) return;

        try{
           if(mex.payload && mex.payload.user_id){
               $http.get("api/v1/clients/services/"+mex.user.preference_service_name).then(((reply) => {
                   let client = reply.data;
                   //let subject = "La piattaforma di notifica Notify di: " + $rootScope.env.ENVIRONMENT + " ha rimosso un messaggio inviato dal servizio: " + mex.user.preference_service_name;
                   //let mail = "La presente per comunicare dell'avvenuta rimozione del messaggio con uuid: " + mex.payload.id + " inviato dal servizio" + mex.user.preference_service_name;
                   let subject = "Notify di " + $rootScope.env.ENVIRONMENT + ": rimozione messaggio utente del servizio: " + mex.user.preference_service_name;
                   let mail = "Buongiorno,\n" + //%0D%0A
                       "in qualità di referente del servizio : "+ mex.user.preference_service_name + ", ti comunichiamo che la notifica con message id:" + mex.payload.id + " è stata rimossa dalle code dell'ambiente di " + $rootScope.env.ENVIRONMENT + " a seguito degli accordi intercorsi con il gestore della piattaforma NOTIFY."
                   //location.href = "mailto:" + client.reference_email + "?cc=" + $rootScope.destinatari.join(";") + "&subject=" + subject + "&body=" + mail;
                   $scope.email_to_send = {};
                   $scope.email_to_send.sender = "noreply.notify@csi.it";
                   $scope.email_to_send.subject = subject;
                   $scope.email_to_send.body = mail;
                   $scope.email_to_send.recipient = client.reference_email;
                   $scope.email_to_send.cc = 'marco.boero@csi.it';
               }), ((error) => {
                   $scope.showDivMessagge = true;
                   $scope.success = false;
                   let errorMessage = "Error from redis status: " + error.data;
                   $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
               }));
            }
            let deletedMessages = (await $http.delete("api/v1/status/redis/queues/" + $scope.queue_name + "/message/"+mex.uuid));
            $scope.showMessageList($scope.queue_name);
            deletedMessages.data == 1?alert("mex deleted"):alert("error, number of messages deleted: " + deletedMessages.data);


        }catch(e){
            console.log("errore deleting",e);
        }
    }


    $scope.deleteMexMap = async function(id,mex){
        if (!confirm("delete message?")) return;

        let deletedMessages = (await $http.delete("api/v1/status/redis/queues/messages/" + id));
        deletedMessages = deletedMessages.data;
        deletedMessages = Object.keys(deletedMessages).map( queue => {
            if(deletedMessages[queue] == 1){
                return queue.split(":")[queue.split(":").length - 1];
            }
            return null;
        }).filter( e => e !== null);
        alert("mex deleted");
        try{
            if(mex.payload && mex.payload.user_id){
                $http.get("api/v1/clients/services/"+mex.user.preference_service_name).then(((reply) => {
                    let client = reply.data;
                    //let subject = "La piattaforma di notifica Notify di: " + $rootScope.env.ENVIRONMENT + " ha rimosso un messaggio inviato dal servizio: " + mex.user.preference_service_name;
                    //let mail = "La presente per comunicare dell'avvenuta rimozione del messaggio con uuid: " + mex.payload.id + " inviato dal servizio" + mex.user.preference_service_name;
                    let subject = "Notify di " + $rootScope.env.ENVIRONMENT + ": rimozione messaggio utente del servizio: " + mex.user.preference_service_name;
                    let mail = "Buongiorno,\n" + //%0D%0A
                        "in qualità di referente del servizio : "+ mex.user.preference_service_name + ", ti comunichiamo che la notifica con message id:" + mex.payload.id + " è stata rimossa dalle code(" + deletedMessages.join(',') + ") dell'ambiente di " + $rootScope.env.ENVIRONMENT + " a seguito degli accordi intercorsi con il gestore della piattaforma NOTIFY."
                    //location.href = "mailto:" + client.reference_email + "?cc=" + $rootScope.destinatari.join(";") + "&subject=" + subject + "&body=" + mail;
                    $scope.email_to_send = {};
                    $scope.email_to_send.sender = "noreply.notify@csi.it";
                    $scope.email_to_send.subject = subject;
                    $scope.email_to_send.body = mail;
                    $scope.email_to_send.recipient = client.reference_email;
                    $scope.email_to_send.cc = 'marco.boero@csi.it';
                }), ((error) => {
                    $scope.showDivMessagge = true;
                    $scope.success = false;
                    let errorMessage = "Error from redis status: " + error.data;
                    $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
                }));
            }
        }catch(e){
            console.log("errore deleting",e);
        }
        $scope.showMap()
    }

    $scope.sendMail = function () {
        $http.post("api/v1/mail/send", $scope.email_to_send).then((result) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Email sent";
        }, (error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error sending email: " + JSON.stringify(error.data);
        });

    };


});
