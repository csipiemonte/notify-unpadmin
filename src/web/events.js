app.controller("events", function ($scope, $http, FileSaver, Blob, $location, $timeout) {

    $scope.params =
        {
            sort: "-created_at",
            limit: 10,
            offset: 0
        };

    $scope.params.filter = typeof $location.search().filter === "object" ? $location.search().filter : {};
    //$scope.selectedSource = $scope.params.filter.source ? $scope.params.filter.source.eq : null;
    //$scope.selectedType = $scope.params.filter.type ? $scope.params.filter.type.eq : null;
    $scope.types = {};
    //$scope.clientsChoises = {};
    //$scope.types = ["ADMIN","CLIENT_ERROR","CLIENT_REQUEST","DB_ERROR","INFO","OK","SECURITY_ERROR","SYSTEM_ERROR"];
    //$scope.sources = ["preferences","pushconsumer","mexconsumer","emailconsumer","mex","smsconsumer"];
    $http.get("api/v1/events/types", {params: $scope.params}).then((reply) => {
        $scope.types = reply.data;
    });

    $http.get("api/v1/events/sources", {params: $scope.params}).then((reply) => {
        $scope.sources = reply.data;
    });


    $scope.set_dates = function (k, n) {
        $scope.params.filter.created_at = {};
        let d1 = new Date();
        d1.setDate(d1.getDate() - n);
        d1.setHours(23)
        d1.setMinutes(59)
        d1.setSeconds(0)
        d1.setMilliseconds(0)
        $scope.params.filter.created_at.lte = d1;// $filter('date')(d1,"dd/MM/yyyy HH:mm");
        let d2 = new Date();
        d2.setDate(d2.getDate() - k);
        d2.setHours(0)
        d2.setMinutes(0)
        d2.setSeconds(0)
        d2.setMilliseconds(0)

        $scope.params.filter.created_at.gte = d2;//"1996-01-01 13:33";//$filter('date')(d2,"dd/MM/yyyy HH:mm");
        $scope.search();
    }

    $scope.search = function () {

        $scope.params.filter = semplify($scope.params.filter);
        let params = JSON.parse(JSON.stringify($scope.params));

        if (params.filter.created_at) {
            params.filter.created_at.gte = new Date(params.filter.created_at.gte);
            params.filter.created_at.lte = new Date(params.filter.created_at.lte);
            params.filter.created_at.gte.setMinutes(params.filter.created_at.gte.getMinutes() - params.filter.created_at.gte.getTimezoneOffset());
            params.filter.created_at.lte.setMinutes(params.filter.created_at.lte.getMinutes() - params.filter.created_at.lte.getTimezoneOffset());
        }

        $http.get("api/v1/events/_page", {params: params}).then((reply) => {
            $scope.events = reply.data.list;
            $scope.totalPages = reply.data.total_pages;
            $scope.currentPage = reply.data.current_page;
            $scope.total_elements = reply.data.total_elements;
        });


    };


    $scope.createReportCSV = function () {

        /*if ($scope.selectedSource !== "") $scope.params.filter.source = {eq: $scope.selectedSource};
        else delete $scope.params.filter.source;

        if ($scope.selectedType !== "") $scope.params.filter.type = {eq: $scope.selectedType};
        else delete $scope.params.filter.type;*/

        $scope.params.filter = semplify($scope.params.filter);

        $http.get("api/v1/report/csv/events", {params: $scope.params, responseType: 'arraybuffer'}).then(((reply) => {

                if (reply.status === 204) {
                    // if there is no content
                    $scope.showDivMessagge = true;

                    $scope.success = false;
                    $scope.resultMessage = "no data found in database with this filter";
                    return;
                }

                // if there is no error the divMessage will be hidden
                $scope.showDivMessagge = false;

                var blob = new Blob([reply.data]);
                var today = new Date();
                FileSaver.saveAs(blob, 'events_' + today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getUTCDate() + "-" +
                    today.getHours() + "-" + today.getMinutes() + "-" + today.getSeconds() + '.csv');


                /*
                var file = new Blob([reply.data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                var fileURL = URL.createObjectURL(file);
                console.log(fileURL);
                //window.open(fileURL,'_blank','');
                //var pdfAsDataUri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"+btoa(reply.data);
                window.open(fileURL);*/
            }),
            (error => {
                // if there is an error such as no content
                $scope.showDivMessagge = true;
                $scope.success = false;
                $scope.resultMessage = error.data;
            }));
    };

    $scope.createReportExcel = function () {

        /*if ($scope.selectedSource !== "") $scope.params.filter.source = {eq: $scope.selectedSource};
        else delete $scope.params.filter.source;

        if ($scope.selectedType !== "") $scope.params.filter.type = {eq: $scope.selectedType};
        else delete $scope.params.filter.type;*/

        $scope.params.filter = semplify($scope.params.filter);

        $http.get("api/v1/report/excel/events", {params: $scope.params, responseType: 'arraybuffer'}).then(((reply) => {

                if (reply.status === 204) {
                    // if there is no content
                    $scope.showDivMessagge = true;

                    $scope.success = false;
                    $scope.resultMessage = "no data found in database with this filter";
                    return;
                }

                // if there is no error the divMessage will be hidden
                $scope.showDivMessagge = false;

                var blob = new Blob([reply.data],
                    {type: 'application/vnd.openxmlformat-officedocument.spreadsheetml.sheet;'});
                var today = new Date();
                FileSaver.saveAs(blob, 'events_' + today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getUTCDate() + "-" +
                    today.getHours() + "-" + today.getMinutes() + "-" + today.getSeconds() + '.xlsx');


                /*
                var file = new Blob([reply.data], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                var fileURL = URL.createObjectURL(file);
                console.log(fileURL);
                //window.open(fileURL,'_blank','');
                //var pdfAsDataUri = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"+btoa(reply.data);
                window.open(fileURL);*/
            }),
            (error => {
                // if there is an error such as no content
                $scope.showDivMessagge = true;

                $scope.success = false;
                $scope.resultMessage = error.data;
            }));
    };


    $scope.openModal = function (title, object, event) {
        $scope.title = title;
        $scope.event = event;
        try {
            $scope.mex = JSON.parse(object);
        } catch (e) {
            $scope.mex = object;
        }

    };

    $scope.succ = function () {
        $scope.params.offset += $scope.params.limit;
        $scope.search();
    };

    $scope.prec = function () {
        if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };


    $scope.choose = function (numPage) {

        $scope.currentPage = numPage;
        $scope.params.offset = $scope.params.limit * (numPage - 1);
        //if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };

    /*$scope.setType = function (type, days) {
        $scope.selectedType = type;
        $scope.selectedSource = "";
        $scope.params.filter.msg_uuid = {};
        $scope.params.filter.bulk_id = {};
        $scope.params.filter.created_at = {};
        $scope.set_dates(1e4, days);

    }*/

    $scope.delete = function () {

        let limit = parseInt(prompt("How many record do you want to delete?", "10000"));
        if (!confirm("delete " + limit + " record?")) return;


        let params = Object.assign({}, $scope.params);
        params.filter = semplify(params.filter);

        if (params.filter.created_at) {
            params.filter.created_at.gte = new Date(params.filter.created_at.gte);
            params.filter.created_at.lte = new Date(params.filter.created_at.lte);
            params.filter.created_at.gte.setMinutes(params.filter.created_at.gte.getMinutes() - params.filter.created_at.gte.getTimezoneOffset());
            params.filter.created_at.lte.setMinutes(params.filter.created_at.lte.getMinutes() - params.filter.created_at.lte.getTimezoneOffset());
        }

        //let par = Object.assign({}, $scope.params);
        params.limit = limit;

        $http.delete("api/v1/events", {params: params}).then((reply) => {
            $scope.search();
        });
    }

    $scope.getPayload = function (id) {
        $http.get("api/v1/events/" + id + "/payload").then((reply) => {
                if (reply.status === 204) {
                    alert("no payload for this event");
                    return;
                }

                var blob = new Blob([JSON.stringify(reply.data, null, 4)]);
                var today = new Date();
                FileSaver.saveAs(blob, id + '_event_payload_' + today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getUTCDate() + "-" +
                    today.getHours() + "-" + today.getMinutes() + "-" + today.getSeconds() + '.json');
            },
            (error => {
                // if there is an error such as no content
                $scope.showDivMessagge = true;
                $scope.success = false;
                $scope.resultMessage = error.data;
            }));
    }

    $scope.clear = function () {
        $scope.params.filter = {};
    }
    $scope.search();
});