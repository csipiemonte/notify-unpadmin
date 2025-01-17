app.controller("users", function ($scope, $http, $location) {

    $scope.params = {
        sort: "-user_id",
        limit: 10,
        offset: 0,
        filter:{}
    };

    $scope.tenants = [];
    $scope.user_id = $location.search().user_id || null;
    $scope.tenant = $location.search().tenant || null;

    $http.get("api/v1/tenants").then((result => {
            $scope.tenants = result.data.map(e => e.name);
    }), (error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting tenants list: " + error.status + " " + error.statusText;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    }));

    $http.get("api/v1/preferences/users/count").then((result => {
        $scope.users_count = result.data;
    }), (error => {
        $scope.showDivMessagge = true;
        $scope.resultMessage = error.data;
    }));

    $scope.searchUsers = function(){
        $scope.params.filter = semplify($scope.params.filter);

        $http.get("api/v1/preferences/users/contacts", {params:$scope.params}).then((result => {
            $scope.users = result.data.list;
            $scope.totalPages = result.data.total_pages;
            $scope.currentPage = result.data.current_page;
            $scope.total_elements = result.data.total_elements;
            delete $scope.userNotify;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }

    $scope.search = function (user_id, tenant) {
        if(user_id) $scope.user_id = user_id;
        if(tenant) $scope.tenant = tenant;
        $scope.showDivMessagge = false;
        $scope.userNotify = null;

        if($scope.user_id && $scope.tenant) {
            $http.get("api/v1/preferences/tenants/" + $scope.tenant + "/users/" + $scope.user_id + "/contacts/").then((result => {
                $scope.userNotify = result.data;
                delete $scope.users;

                if ($scope.userNotify.push) $scope.userNotify.push = JSON.parse($scope.userNotify.push)
            }), (error => {
                $scope.showDivMessagge = true;
                $scope.resultMessage = error.data;
            }));

            $http.get("api/v1/preferences/tenants/" + $scope.tenant + "/users/" + $scope.user_id + "/preferences/").then((result => {
                $scope.listPreferences = result.data
            }), (error => {
                $scope.showDivMessagge = true;
                $scope.resultMessage = error.data;
            }));

            delete $scope.users;
        }
    }

    $scope.openModal = function (ob) {

        $scope.selected_user = ob;

        $http.get("api/v1/preferences/users/" + $scope.selected_user.user_id + "/preferences/").then((result => $scope.listPreferences = result.data),(error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting list of users: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        } ));

    };

    $scope.succ = function () {
        $scope.params.offset += $scope.params.limit;
        $scope.searchUsers();
    };

    $scope.prec = function () {
        if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.searchUsers();
    };


    $scope.choose = function (numPage) {

        $scope.currentPage = numPage;
        $scope.params.offset = $scope.params.limit * (numPage - 1);
        //if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.searchUsers();
    };

    if($scope.user_id) $scope.search();

    $location.search('user_id', null);
    $location.search('tenant', null);
});
