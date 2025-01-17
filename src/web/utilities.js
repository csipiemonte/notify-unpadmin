app.controller("utilities", function ($rootScope, $scope, $http, $location, $timeout, jwtHelper, $crypto) {


    $http.get("api/v1/environment_variables").then((result => {
        $scope.environment_variables = result.data;
    }),((error) => {
        $scope.showDivMessagge = true;
        $scope.success = false;
        let errorMessage = "Error while get environment variables: " + error.data;
        $scope.resultMessage = errorMessage;
    }));

    $scope.decryptAES = function(){
        $scope.token = "";
        $http.get("api/v1/token/decrypt_utility", {params: {token: $scope.token_notify,password: $scope.password}}).then((result => {
            $scope.token_notify_jwt = result.data;
            $scope.token = jwtHelper.decodeToken($scope.token_notify_jwt);

            $scope.token.iat = new Date($scope.token.iat * 1000);
            $scope.token.exp = new Date($scope.token.exp * 1000);

            let applications = $scope.token.applications;
            $scope.token.applications = {};
            Object.keys(applications).forEach(application => {
                $scope.token.applications[application] = {};
                applications[application].forEach(permission => $scope.token.applications[application][permission] = true)
            })
            $scope.showDivMessagge = false;

        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while decrypting token (maybe, wrong password?):<br>" + JSON.stringify(error);
            $scope.resultMessage = errorMessage;
        }));
    }

    $scope.decryptAES = function(){
        $scope.token = "";
        $http.get("api/v1/token/decrypt_utility", {params: {token: $scope.token_notify,password: $scope.password}}).then((result => {
            $scope.token_notify_jwt = result.data;
            $scope.token = jwtHelper.decodeToken($scope.token_notify_jwt);

            $scope.token.iat = new Date($scope.token.iat * 1000);
            $scope.token.exp = new Date($scope.token.exp * 1000);

            let applications = $scope.token.applications;
            $scope.token.applications = {};
            Object.keys(applications).forEach(application => {
                $scope.token.applications[application] = {};
                applications[application].forEach(permission => $scope.token.applications[application][permission] = true)
            })
            $scope.showDivMessagge = false;

        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while decrypting token (maybe, wrong password?):<br>" + JSON.stringify(error);
            $scope.resultMessage = errorMessage;
        }));
    }

    $scope.encryptAES = function(){
        $scope.token = "";
        $http.put("api/v1/token/crypt_utility", {token: $scope.token_notify,password: $scope.password}).then((result => {
            $scope.token_notify_jwt = result.data;
            $scope.showDivMessagge = false;
        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while encrypting token (maybe, wrong password?):<br>" + JSON.stringify(error);
            $scope.resultMessage = errorMessage;
        }));
    }

});
