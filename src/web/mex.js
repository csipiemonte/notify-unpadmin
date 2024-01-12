app.controller("mex", function ($scope, $http,$filter,FileSaver,Blob,$location,$timeout) {

    /*$scope.user_id_to_delete = "";
    $scope.uuid_to_delete = "";*/

    $scope.params =
        {
            filter: {
                id:{
                }
            },
            sort: "-timestamp",
            limit: 10,
            offset: 0
        };


    if($location.search().mex_id) $scope.params.filter.id.eq = $location.search().mex_id;


    $scope.set_dates = function(k, n)
    {
        $scope.params.filter.timestamp = {};
        let d1 = new Date();
        d1.setDate(d1.getDate() - n);
        d1.setHours(23)
        d1.setMinutes(59)
        d1.setSeconds(0)
        d1.setMilliseconds(0)
        $scope.params.filter.timestamp.lte = d1;// $filter('date')(d1,"dd/MM/yyyy HH:mm");
        let d2 = new Date();
        d2.setDate(d2.getDate() - k);
        d2.setHours(0)
        d2.setMinutes(0)
        d2.setSeconds(0)
        d2.setMilliseconds(0)

        $scope.params.filter.timestamp.gte = d2;//"1996-01-01 13:33";//$filter('date')(d2,"dd/MM/yyyy HH:mm");
        $scope.search();
    }

    /*$scope.params.filter.timestamp = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - 1, d.getMinutes(), d.getSeconds()),
        lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    };*/

    $http.get("api/v1/messages/senders").then((reply) => {$scope.senders = reply.data;});

    $scope.search = function () {
        if ($scope.selectedSender !== "") $scope.params.filter.sender = {eq: $scope.selectedSender};
        else delete $scope.params.filter.sender;

        $scope.params.filter = semplify($scope.params.filter);

        if($scope.params.filter.id && $scope.params.filter.id.eq.length !== 36){
            $scope.params.filter.id.ci = $scope.params.filter.id.eq;
            delete $scope.params.filter.id.eq;
        }
        let params = JSON.parse(JSON.stringify($scope.params));
        if (params.filter.timestamp) {
            params.filter.timestamp.gte = new Date(params.filter.timestamp.gte);
            params.filter.timestamp.lte = new Date(params.filter.timestamp.lte);
            params.filter.timestamp.gte.setMinutes(params.filter.timestamp.gte.getMinutes() - params.filter.timestamp.gte.getTimezoneOffset());
            params.filter.timestamp.lte.setMinutes(params.filter.timestamp.lte.getMinutes() - params.filter.timestamp.lte.getTimezoneOffset());
        }
        $http.get("api/v1/messages/_page", {params: params}).then((reply) => {
            $scope.messages = reply.data.list;
            $scope.totalPages = reply.data.total_pages;
            $scope.currentPage = reply.data.current_page;
            $scope.pageSize = reply.data.page_size;
            $scope.total_elements = reply.data.total_elements;
            $scope.params.filter.id = {};
        });

    };


    $scope.createReportCSV = function () {



        $scope.params.filter = semplify($scope.params.filter);

        if ($scope.selectedSender !== "") $scope.params.filter.sender = {eq: $scope.selectedSender};
        else delete $scope.params.filter.sender;

        $http.get("api/v1/report/csv/messages", {params: $scope.params, responseType: 'arraybuffer'}).then(((reply) => {

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
                FileSaver.saveAs(blob, 'events-' + today.getFullYear() + "-" + today.getUTCMonth() + 1 + "-" + today.getUTCDate() + "-" +
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



        $scope.params.filter = semplify($scope.params.filter);

        if ($scope.selectedSender !== "") $scope.params.filter.sender = {eq: $scope.selectedSender};
        else delete $scope.params.filter.sender;

        $http.get("api/v1/report/excel/messages", {params: $scope.params, responseType: 'arraybuffer'}).then(((reply) => {

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
                FileSaver.saveAs(blob, 'messages_' + today.getFullYear() + "-" + today.getUTCMonth() + 1 + "-" + today.getUTCDate() + "-" +
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


    $scope.succ = function () {
        //if($scope.currentPage >= $scope.totalPages) return;
        $scope.params.offset += $scope.params.limit;
        $scope.search();
    };

    $scope.prec = function () {
        if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };


    $scope.openModal = function (mex) {
        try{
            $scope.mex = JSON.parse(mex)
        }catch(e){
            $scope.mex = mex;
        }
    };

    $scope.choose = function (numPage) {

        $scope.currentPage = numPage;
        $scope.params.offset = $scope.params.limit * (numPage -1);
        //if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };
    /**
     * convert message taken from db to message well formatted
     * @param m message to  format
     * @returns {*}
     */
    $scope.toMessage = function(m) {
        var x = {
            id: m.id,
            bulk_id: m.bulk_id,
            user_id: m.user_id,
            email: {
                to: m.email_to,
                subject: m.email_subject,
                body: m.email_body,
                template_id: m.email_template_id
            },
            sms: {
                phone: m.sms_phone,
                content: m.sms_content
            },
            push: {
                token: m.push_token,
                title: m.push_title,
                body: m.push_body,
                call_to_action: m.push_call_to_action
            },
            mex: {
                title: m.mex_title,
                body: m.mex_body,
                call_to_action: m.mex_call_to_action
            },
            io: m.io,
            memo: m.memo,
            tag: m.tag,
            correlation_id: m.correlation_id,
            read_at: m.read_at,
            timestamp: m.timestamp
        };
        return x;
    }

    $scope.search();
});