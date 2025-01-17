app.controller("preferences_console", function ($scope, $http,$location) {

    $scope.params = {
        sort: "-user_id",
        limit: 10,
        offset: 0,
        filter:{}
    };


    $http.get("api/v1/preferences/users/count").then((result => {
        $scope.users_count = result.data;
    }), (error => {
        $scope.showDivMessagge = true;
        $scope.resultMessage = error.data;
    }));


    $scope.getServices = function (){
        $scope.showDivMessagge = false;

        $http.get("api/v1/preferences/users/services/stats").then((result => {
            $scope.services = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));

    }

    $scope.getUsersFromServices = function(service_name, tenant, channel){
        $scope.params.filter = semplify($scope.params.filter);

        $http.get("api/v1/preferences/users/_page",{params: $scope.params}).then((reply => {
            $scope.users = reply.data.list;
            $scope.totalPages = reply.data.total_pages;
            $scope.currentPage = reply.data.current_page;
            $scope.total_elements = reply.data.total_elements;
            $scope.users_service_name = service_name;
            $scope.users_channel = channel;
            $scope.users_tenant = tenant;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = JSON.stringify(error.data);
        }));
    }


    $scope.getTermsFromUser = function(user_id){
        $http.get("api/v1/preferences/terms",{params:{user_id:user_id}}).then((result => {
            $scope.users = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }

    $scope.succ = function () {
        $scope.params.offset += $scope.params.limit;
        $scope.getUsersFromServices();
    };

    $scope.prec = function () {
        if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.getUsersFromServices();
    };


    $scope.choose = function (numPage) {

        $scope.currentPage = numPage;
        $scope.params.offset = $scope.params.limit * (numPage - 1);
        //if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.getUsersFromServices();
    };

    $scope.openTermsModal = function(user_id, tenant){
        $http.get("api/v1/preferences/terms",{params:{user_id: user_id, tenant: tenant}}).then((result => {
            $scope.terms = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }

    $scope.openHistoryModal = function(user_id, tenant){
        $http.get("api/v1/preferences/users/" + user_id + "/contacts/history",{params:{user_id: user_id, tenant: tenant}}).then((result => {
            $scope.users_history = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }
    $scope.getServices();
});
