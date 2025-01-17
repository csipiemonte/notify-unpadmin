app.controller("preferences-service", function ($scope, $http, $location) {


    var uuid = $location.search().service_uuid;
    $http.get("api/v1/preferences/services/" + uuid).then((result => {


        $scope.service = result.data ? result.data : {
            name: '',
            channels: [],
            token_notify: '',
            uuid: uuid
        };

        // if is a string it is converted to array
        $scope.service.channels = typeof $scope.service.channels === "string" ? $scope.service.channels.split(",") : $scope.service.channels;

        $scope.availableChannels = {
            "Push": $scope.service.channels.includes("push"),
            "Email": $scope.service.channels.includes("email"),
            "SMS": $scope.service.channels.includes("sms")
        };

        //$scope.service.oldServiceName = $scope.service.name;

    }), ((error) => {
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while set preferences services: " + error.status + " " + error.statusText;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    }));


    $scope.savePreference = function () {

        if (!$scope.service.name || $scope.service.name.length === 0 ) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error: service name cannot be empty";
            return;
        }

        var filter = {"name": {"eq": $scope.service.name}};
        $http.get("api/v1/preferences/services", {params: {filter: filter}}).then((result => {

            let url = 'api/v1/preferences/services/' + $scope.service.name;
            //let url = 'api/v1/preferences/services/' + $scope.service.oldServiceName !== $scope.service.name ? $scope.service.oldServiceName : $scope.service.name;

            $scope.service.channels = [];
            Object.keys($scope.availableChannels)
                .forEach(e => {
                    if ($scope.availableChannels[e]) $scope.service.channels.push(e.toLowerCase());
                });


            var data = $scope.service;
            data.channels = data.channels.join(",");
            delete data.oldServiceName;

            $http({
                method: "PUT",
                url: url,
                data: data
            }).then((result => {
                    $scope.showDivMessagge = true;

                    $scope.success = true;
                    $scope.resultMessage = "operation successful";
                    $scope.service.oldServiceName = $scope.service.name;

                }),
                ((error) => {
                    $scope.showDivMessagge = true;

                    $scope.success = false;
                    $scope.resultMessage = "Error: " + JSON.stringify(error.data);
                }));
        }));


    };


});
