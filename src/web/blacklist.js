app.controller("blacklist", function ($rootScope, $scope, $http) {

    search();
    getServices();

    function search(){
        $http.get("api/v1/redis/keys/mb:blacklist").then((result => {
            $scope.blacklist = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }

    function getServices(){
        $http.get("api/v1/preferences/services").then((result => {
          $scope.services = result.data.map(e => e.name);
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));

    }

    $scope.delete = async function(key) {
        if (!confirm("delete from blacklist?")) return;
        try {
            await $http.delete("api/v1/redis/keys/mb:blacklist/" + key);
            search();
        }catch(error) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error deleting from blacklist: " + JSON.stringify(error);
        }
    }

    $scope.insertOrUpdate = async function(name,token){
        var element = {
            key: name,
            value: token
        };
        try{
            await $http.post("api/v1/redis/keys/mb:blacklist/", element);
            $scope.name="";
            $scope.token="";
            search();
        }catch(e){
            $scope.$applyAsync();
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error in insert blacklist: " + JSON.stringify(e);
        }
    }


})
