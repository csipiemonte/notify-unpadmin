app.controller("menu", function ($rootScope,$scope, $location,$http) {

    $http.get("api/v1/user").then((reply) => {
        $rootScope.user = reply.data;
        $rootScope.logout_url = $rootScope.user.logout_url;
    });

    $http.get("api/v1/environment_variables", {params: $scope.params}).then((reply) => {
        $rootScope.env = reply.data;
    });

    $http.get("api/v1/destinatari").then((reply) => {
        $rootScope.destinatari = reply.data;
    }).catch(function(e) {
    });

    $scope.currentPage = $location.search()["currentPage"];
    $scope.currentPage = !$scope.currentPage ? "home.html" : $scope.currentPage + ".html";

    $scope.go = function (destination, params) {
        $scope.currentPage = destination + ".html";
        if (params)
            for (var k in params) $location.search(k, params[k]);
        $location.search('currentPage', destination);
    };

    $scope.$root.uuid = function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
    $scope.isActive = function (viewLocation) {
        return viewLocation+'.html' === $scope.currentPage;
    };
})
