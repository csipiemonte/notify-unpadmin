app.controller("clients", function ($scope, $http) {

    $scope.showDivMessagge = false;

    $scope.list = [];
    $http.get("api/v1/clients")
    .then((result => $scope.list = result.data))
    .catch(error =>{
        $scope.showDivMessagge = true;

        $scope.success = false;
        let errorMessage = "Error while getting list of clients: " + error.data;
        $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
    });

    $scope.params =
        {
            filter: {},
            sort: "+client_name",
            limit: 10,
            offset: 0
        };

    $scope.createReport = function () {

        $http.get("api/v1/report/clients", {params: $scope.params, responseType: 'arraybuffer'}).then((reply => {

            if(reply.status === 204){
                // if there is no content
                $scope.showDivMessagge = true;

                $scope.success = false;
                $scope.resultMessage = "no data found in database with this filter";
                return;
            }

            var blob = new Blob([reply.data],
                {type: 'application/vnd.openxmlformat-officedocument.spreadsheetml.sheet;'});
            var today = new Date();
            saveAs(blob, 'clients-' + today.getFullYear() + "-" + today.getUTCMonth() +1 + "-" + today.getUTCDate() + "-" +
                today.getHours() + "-" + today.getMinutes()+ "-" + today.getSeconds() + '.xlsx');


            /*
            var file = new Blob([reply.data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            var fileURL = URL.createObjectURL(file);
            console.log(fileURL);
            //window.open(fileURL,'_blank','');
            //var pdfAsDataUri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"+btoa(reply.data);
            window.open(fileURL);*/
        }),(error => {
            $scope.showDivMessagge = true;

            $scope.success = false;
            let errorMessage = "Error while creating report: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        } ));
    };
});
