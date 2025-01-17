app.controller("server-status", function ($scope, $http, $interval, $timeout, $window) {

    $scope.process_info_to_see = ["USER","PID","%CPU","%MEM","COMMAND","memory_usage","uptime"];
    function getServerStatus() {
        $http.get("api/v1/status/monitor").then((reply) => {

            let unp_status = reply.data;
            let hosts = Object.keys(unp_status);
            $scope.hosts = hosts;
            let processes = [];
            for (let host of hosts)
                processes = processes.concat(Object.keys(unp_status[host]));

            let obj_proc = {};
            processes.forEach( p => obj_proc[p] = "");
            processes = Object.keys(obj_proc);

            $scope.processes = processes;

            $scope.unp_server_status = Array.from(new Set(processes))
                .map(p => {
                    let r = {};
                    r[p] = {};
                    for (let h of hosts) r[p][h] = unp_status[h][p];
                    return r;
                }).reduce((r, e) => {
                    let k = Object.keys(e)[0];
                    r[k] = e[k];
                    return r;
                }, {});

        });

        $http.get("api/v1/status/monitor-mb").then((reply) => {

            let unp_status = reply.data;
            let hosts = Object.keys(unp_status);
            $scope.mbhosts = hosts;
            let processes = [];
            for (let host of hosts)
                processes = processes.concat(Object.keys(unp_status[host]));

            let obj_proc = {};
            processes.forEach( p => obj_proc[p] = "");
            processes = Object.keys(obj_proc);

            $scope.mbprocesses = processes;

            $scope.unp_mbserver_status = Array.from(new Set(processes))
                .map(p => {
                    let r = {};
                    r[p] = {};
                    for (let h of hosts) r[p][h] = unp_status[h][p];
                    return r;
                }).reduce((r, e) => {
                    let k = Object.keys(e)[0];
                    r[k] = e[k];
                    return r;
                }, {});
        });
    }

    getServerStatus();

    var refreshServerStatus = $interval(getServerStatus, 5000);

    $scope.$on('$destroy', function () {
        if (refreshServerStatus) $interval.cancel(refreshServerStatus);
    });

    $scope.openModal = function (process, host, pid) {

        $scope.actionProcess = {};
        $scope.actionProcess.process = process;
        $scope.actionProcess.host = host;
        $scope.actionProcess.pid = pid;
        if (pid && pid !== '')
            $http.get("api/v1/status/process/" + pid + "/status", {params: {host: host}}).then((reply) => {
                $scope.actionProcess = reply.data;
                $scope.actionProcess.process = process;
                $scope.actionProcess.host = host;
                $scope.actionProcess.pid = pid;
            });
    }

    $scope.openHostModal = function (host) {
        $scope.hostInfo = {};
        $http.get("api/v1/status/" + host + "/status").then((reply) => {
            $scope.hostInfo = reply.data;
            $scope.hostInfo.host = host;
        });
    }

    $scope.executeOperation = function (operation) {
        $http.post("api/v1/status/host/" + $scope.actionProcess.host + "/" + operation + "/" + $scope.actionProcess.process, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operation successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while starting process: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.executeOperationOnHost = function (operation,host) {
        $http.post("api/v1/status/host/" + host + "/processes/" + operation + "?processes=" + $scope.processes, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operation successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while starting process: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.executeOperationOnMBHost = function (operation,host) {
        $http.post("api/v1/status/host/" + host + "/processes/" + operation + "?processes=" + $scope.mbprocesses, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operation successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while starting process: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.managePm2OnHost = function (operation,host) {
        $http.post("api/v1/status/host/" + host + "/pm2/" + operation, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operation successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while starting process: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.executeOperationOnProcess = function (operation,process) {
        $http.post("api/v1/status/hosts/" + process + "/" + operation + "?hosts=" + $scope.hosts, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operations successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while execute operation on process in all hosts: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.executeOperationOnMBProcess = function (operation,process) {
        $http.post("api/v1/status/hosts/" + process + "/" + operation + "?hosts=" + $scope.mbhosts, {}).then((reply) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Operations successfully Executed";
            $timeout(getServerStatus, 3000);
            $window.location.reload();
        }, (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error while execute operation on process in all mb-hosts: " + JSON.stringify(error.data, null, 4);
        }));
    }

    $scope.resetMessages = function () {
        $scope.showDivMessagge = "";
        $scope.success = false;
        $scope.resultMessage = "";
    }

});