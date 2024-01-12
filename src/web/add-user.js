app.controller("add-user", function ($scope, $http, $location, $timeout) {

    new Clipboard('.btn');
    $scope.showDivMessagge = false;

    $scope.permissions = ["admin","user","backend"];

    $scope.selectedPermissions = [];


    $http.get("api/v1/clients/" + uuid).then((result => {
        $scope.existClient = !!result.data;
        $scope.client = result.data ? result.data : {
            client_id: uuid,
            subscription_date: new Date()
        };

        // if user changes the client name, i ll keep track of the old name
        $scope.oldClientName = $scope.client.client_name;

    }), ((error) => {
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while getting client: " + error.data;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    }));

    $http.get("api/v1/preferences/services").then((result => {

        $scope.preferences = result.data.map( e => e.name);

    }), ((error) => {
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while getting preferences/services list: " + error.data;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    }));


    /*$http.get("api/v1/clients/column_types/client_types").then((result => {
        $scope.types = result.data;
    }), (error => {
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while getting types of client:" + error.data;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    }));*/

    $scope.saveUser = function () {
        //var prova =   {uuid: 1, name: "client 222222222222222222222", email:"client1@email.com", anagprod:"a1", subscription_date: new Date().getTime()};
        //alert(JSON.stringify($scope.client));
        $http.put("api/v1/clients/" + uuid, $scope.client)
            .then((result => {
                    $scope.showDivMessagge = true;

                    $scope.existClient = true;
                    $scope.success = true;
                    $scope.resultMessage = "client successfully created";

                    /*$scope.preferences.flag_email = +$scope.channels.Email;
                    $scope.preferences.flag_sms = +$scope.channels.SMS;
                    $scope.preferences.flag_push = +$scope.channels.Push;*/
                    // if oldclientName is undifned means that user it s creating new client
                    $scope.preferences.oldClientName = $scope.oldClientName ? $scope.oldClientName : $scope.client.client_name;


                   /* $http.put("api/v1/clients/preferences/" + uuid, $scope.preferences)
                        .then((result => {
                                // if user changes the client name again, i ll keep track of the old name
                                $scope.oldClientName = $scope.client.client_name;
                            }),
                            ((error) => {
                                $scope.showDivMessagge = true;

                                $scope.success = false;
                                var errorMessage = "Error in client creation (preferences) : " + error.data;
                                $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
                            }));*/
                }),
                ((error) => {
                    $scope.showDivMessagge = true;

                    $scope.success = false;
                    $scope.resultMessage = "Error in client creation: " + JSON.stringify(error.data);
                }));

    };
    $scope.getToken = function (service, expireDate) {

        //expireDate = expireDate ? expireDate : new Date($scope.defaultDate);
        $http.get("api/v1/clients/" + uuid + "/token/" + service, {
            params: {
                expire: expireDate.getTime(),
                permissions : $scope.selectedPermissions
            }
        }).then((result => {
            $scope.token = result.data;

            let splittedToken = $scope.token.split(".");
            $scope.tokenHeader = atob(splittedToken[0]);
            $scope.tokenPayload = atob(splittedToken[1]);

            let body = "Questo è il token richiesto per il servizio " + service + ":%0D%0A%0D%0A" + $scope.token;
            location.href = "mailto:" + $scope.client.reference_email + "?cc=marco.boero@csi.it&subject=Token per ambiente di test per il servizio " +
                service + "&body=" + body;
        }), (error => {
            $scope.showDivMessagge = true;

            $scope.success = false;
            let errorMessage = "Error while getting token: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));
    };


    $scope.openModal = function (ob) {
        $scope.selected_client = ob;

        let today = new Date();
        $scope.dateExpire = new Date(today.getFullYear() + "-12-31");

    };

    /*  $scope.open = function ($event) {

          $event.preventDefault();
          $event.stopPropagation();

          $scope.opened = true;
      };*/
});
