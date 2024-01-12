app.controller("templates", function ($rootScope, $scope, $http,FileSaver, Blob) {

    search();

    function search(){
        $http.get("api/v1/redis/keys/mb:template:email").then((result => {
            $scope.templates = result.data;
        }), (error => {
            $scope.showDivMessagge = true;
            $scope.resultMessage = error.data;
        }));
    }



    $scope.downloadHTML = function(name,base64){

        let html = decodeURIComponent(escape(window.atob(base64)));

        console.log(html)
        var blob = new Blob([html]);
        var today = new Date();
        FileSaver.saveAs(blob, name);
    }

    $scope.delete = async function(key) {
        if (!confirm("delete template?")) return;
        try {
            await $http.delete("api/v1/redis/keys/mb:template:email/" + key);
            search();
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "template email deleted";
        }catch(error) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error deleting template email: " + JSON.stringify(error);
        }
    }

    $scope.upload = function(){
        let r = new FileReader()
        r.onloadend = async function(e){
            $scope.template_data = e.target.result;
            var template = {
                key: $scope.template_name,
                value: btoa($scope.template_data)
            };
            try{
                await $http.post("api/v1/redis/keys/mb:template:email", template);
                search();
            }catch(e){
                $scope.$applyAsync();
                $scope.showDivMessagge = true;
                $scope.success = false;
                $scope.resultMessage = "Error in template upload: " + JSON.stringify(e);
            }

        }
        r.readAsBinaryString($scope.template_file);
    }
})