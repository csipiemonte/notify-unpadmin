app.controller("tags", function ($scope, $http) {

    $scope.showDivMessagge = false;
    $scope.showAddTagMessagge = false;
    $scope.tags_list = [];
    $scope.tag_form = {};

    getTagsList();
    async function getTagsList() {
        $http.get("api/v1/tags").then(result => {
            $scope.tags_list = result.data;
            $scope.showDivMessagge = false;
            $scope.success = true;
            $scope.$applyAsync();
        }).catch(error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting tags list: " + error.status + " " + error.statusText;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
            $scope.$applyAsync();
        });
    }

    $scope.refresh = async function(){
        $scope.tag_form = {};
        $scope.tagForm.$setPristine();
        $scope.tagForm.$setUntouched();
        getTagsList();
        $scope.showDivMessagge = false;
        $scope.success = true;
        $scope.resultMessage = "";
        $scope.$applyAsync();
    }

    $scope.addTag = async function () {
        $http.post("api/v1/tags", $scope.tag_form).then(result => {
            $scope.showAddTagMessagge = true;
            $scope.addTagSuccess = true;
            $scope.addTagResultMessage = "Tag " + $scope.tag_form.name + " succesfully added!";
            $scope.tag_form = {};
            $scope.tagForm.$setPristine();
            $scope.tagForm.$setUntouched();
            $scope.$applyAsync();
        }).catch(error => {
            $scope.showAddTagMessagge = true;
            $scope.addTagSuccess = false;
            $scope.addTagResultMessage = "Error while adding tag: <strong>" + error.status + " " + error.statusText + "</strong><br/>Details:<br/>" + JSON.stringify(error.data, null, 4);
            $scope.$applyAsync();
        });
    };

});
