app.controller("preferences-services", function ($scope, $http) {

    $scope.showDivMessagge = false;

    $scope.list = [];
    $http.get("api/v1/preferences/services").then(result => $scope.list = result.data.map(e => { e.tags = e.tags.join(","); return e;})
    ).catch(error => {
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while getting list of services: " + error.data;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    });

    $scope.params =
        {
            filter: {},
            sort: "+service_name",
            limit: 10,
            offset: 0
        };


});
