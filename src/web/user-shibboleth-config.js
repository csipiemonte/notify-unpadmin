app.controller("user-shibboleth-config", function ($scope, $http) {

    function search() {
        $http.get("api/v1/users-permissions").then((result => {
            $scope.users = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));

    }

    $scope.insertOrUpdate = function () {
        if (!$scope.newUserCf || $scope.newUserCf.replace(/\s/g, "") === "") return;
        $http.put("api/v1/users-permissions/" + $scope.newUserCf, {
                    cf: $scope.newUserCf.replace(/\s/g, ""),
                    username: $scope.newUserUsername.trim(),
                    roles: $scope.newUserRoles
        }).then((result => {
            $scope.users = result.data;
            delete $scope.newUserCf;
            delete $scope.newUserUsername;
            delete $scope.newUserRoles;
            search();
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }

    $scope.delete = function (user_cf) {
        if (!confirm("delete " + user_cf + "?")) return;
        $http.delete("api/v1/users-permissions/" + user_cf).then((result => {
            search();
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    };

    search();
});
