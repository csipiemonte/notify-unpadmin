app.controller("tenants", function ($scope, $http) {

    $scope.showDivMessagge = false;
    $scope.showAddTenantMessagge = false;
    $scope.tenants_list = [];
    $scope.tenant_form = {};

    getTenantsList();
    async function getTenantsList() {
        $http.get("api/v1/tenants").then(result => {
            $scope.tenants_list = result.data;
            $scope.showDivMessagge = false;
            $scope.success = true;
            $scope.$applyAsync();
        }).catch(error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting tenants list: " + error.status + " " + error.statusText;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
            $scope.$applyAsync();
        });
    }

    $scope.refresh = async function(){
        $scope.tenant_form = {};
        $scope.tenantForm.$setPristine();
        $scope.tenantForm.$setUntouched();
        getTenantsList();
        $scope.showDivMessagge = false;
        $scope.success = true;
        $scope.resultMessage = "";
        $scope.$applyAsync();
    }

    $scope.addTenant = async function () {
        $http.post("api/v1/tenants", $scope.tenant_form).then(result => {
            $scope.showAddTenantMessagge = true;
            $scope.addTenantSuccess = true;
            $scope.addTenantResultMessage = "Tenant " + $scope.tenant_form.name + " succesfully added!";
            $scope.tenant_form = {};
            $scope.tenantForm.$setPristine();
            $scope.tenantForm.$setUntouched();
            $scope.$applyAsync();
        }).catch(error => {
            $scope.showAddTenantMessagge = true;
            $scope.addTenantSuccess = false;
            $scope.addTenantResultMessage = "Error while adding tenant: <strong>" + error.status + " " + error.statusText + "</strong><br/>Details:<br/>" + JSON.stringify(error.data, null, 4);
            $scope.$applyAsync();
        });
    };

    $scope.togglePassword = function () {
        var x = document.getElementById("tenant_io_manage_apikey");
        if (x.type === "password") {
          x.type = "text";
        } else {
          x.type = "password";
        }
    };

});
