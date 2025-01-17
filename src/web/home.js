app.controller("home", function ($rootScope, $scope, $http) {

    var legendConf = {
        display: true,
        position: 'right'
    }

    $scope.emailLabels = [];
    $scope.emailLabelsColors = [];
    $scope.emailData = [];
    $scope.emailOptions= {
        title: {
            display: true,
            text: 'emailconsumer'
        },
        legend: legendConf
    }
    $scope.emailCount = 0;

    $scope.ioLabels = [];
    $scope.ioLabelsColors = [];
    $scope.ioData = [];
    $scope.ioOptions= {
        title: {
            display: true,
            text: 'ioconsumer'
        },
        legend: legendConf
    }
    $scope.ioCount = 0;

    $scope.mexLabels = [];
    $scope.mexLabelsColors = [];
    $scope.mexData = [];
    $scope.mexOptions= {
        title: {
            display: true,
            text: 'mexconsumer'
        },
        legend: legendConf
    }
    $scope.mexCount = 0;

    $scope.pushLabels = [];
    $scope.pushLabelsColors = [];
    $scope.pushData = [];
    $scope.pushOptions= {
        title: {
            display: true,
            text: 'pushconsumer'
        },
        legend: legendConf
    }
    $scope.pushCount = 0;

    $scope.smsLabels = [];
    $scope.smsLabelsColors = [];
    $scope.smsData = [];
    $scope.smsOptions= {
        title: {
            display: true,
            text: 'smsconsumer'
        },
        legend: legendConf
    }
    $scope.smsCount = 0;

    $scope.services_count = '-';
    $scope.users_count = '-';
    $scope.messages_count = '-';

    $scope.consumer_sender = [
        {
            sender: "stacore",
            source: "emailconsumer",
            count: 10
        },
        {
            sender: "ritiroreferti",
            source: "emailconsumer",
            count: 9
        },
        {
            sender: "ritiroreferti",
            source: "ioconsumer",
            count: 9
        }
    ]

    $http.get("api/v1/dashboard/overview").then((reply) => {
        $scope.services_count = parseInt(reply.data.services_count).toLocaleString();
        $scope.users_count = parseInt(reply.data.users_count).toLocaleString();
        $scope.messages_count = parseInt(reply.data.messages_count).toLocaleString();

        if(reply.data.consumers['emailconsumer']) {
            $scope.emailLabels = reply.data.consumers['emailconsumer'].type;
            $scope.emailLabels.forEach((element) => $scope.emailLabelsColors.push(labelsColors(element)));
            $scope.emailData = reply.data.consumers['emailconsumer'].data;
            $scope.emailCount = reply.data.consumers['emailconsumer'].data.reduce((partialSum, a) => parseInt(partialSum) + parseInt(a), 0)
        }

        if(reply.data.consumers['ioconsumer']) {
            $scope.ioLabels = reply.data.consumers['ioconsumer'].type;
            $scope.ioLabels.forEach((element) => $scope.ioLabelsColors.push(labelsColors(element)));
            $scope.ioData = reply.data.consumers['ioconsumer'].data;
            $scope.ioCount = reply.data.consumers['ioconsumer'].data.reduce((partialSum, a) => parseInt(partialSum) + parseInt(a), 0)
        }

        if(reply.data.consumers['mexconsumer']) {
            $scope.mexLabels = reply.data.consumers['mexconsumer'].type;
            $scope.mexLabels.forEach((element) => $scope.mexLabelsColors.push(labelsColors(element)));
            $scope.mexData = reply.data.consumers['mexconsumer'].data;
            $scope.mexCount = reply.data.consumers['mexconsumer'].data.reduce((partialSum, a) => parseInt(partialSum) + parseInt(a), 0)
        }

        if(reply.data.consumers['pushconsumer']) {
            $scope.pushLabels = reply.data.consumers['pushconsumer'].type;
            $scope.pushLabels.forEach((element) => $scope.pushLabelsColors.push(labelsColors(element)));
            $scope.pushData = reply.data.consumers['pushconsumer'].data;
            $scope.pushCount = reply.data.consumers['pushconsumer'].data.reduce((partialSum, a) => parseInt(partialSum) + parseInt(a), 0)
        }

        if(reply.data.consumers['smsconsumer']) {
            $scope.smsLabels = reply.data.consumers['smsconsumer'].type;
            $scope.smsLabels.forEach((element) => $scope.smsLabelsColors.push(labelsColors(element)));
            $scope.smsData = reply.data.consumers['smsconsumer'].data;
            $scope.smsCount = reply.data.consumers['smsconsumer'].data.reduce((partialSum, a) => parseInt(partialSum) + parseInt(a), 0)
        }

        $scope.consumer_sender = reply.data.senders;
    });

    function labelsColors(element) {
        if(element == 'OK') {
            return 'rgba(70,191,189,1)';
        } else if (element == 'INFO') {
            return 'rgba(151,187,205,1)';
        } else if(element == 'RETRY') {
            return 'rgba(253,180,92,1)';
        } else if(element == 'SYSTEM_ERROR') {
            return 'rgba(247,70,74,1)';
        } else if(element == 'CLIENT_ERROR') {
            return 'rgba(220,220,220,1)';
        }
    }

});