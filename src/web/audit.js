app.controller("audit", function ($scope, $http,usSpinnerService,$timeout) {

    $scope.params =
        {
            filter: {},
            sort: "-timestamp",
            limit: 20,
            offset: 0
        };

    var d = new Date();

    /*$scope.params.filter.timestamp = {
        gte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - 1, d.getMinutes(), d.getSeconds()),
        lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    };*/



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

    $http.get("api/v1/audit/clients", {params: $scope.params}).then((reply) => {
        $scope.clients = reply.data;
    });
    $http.get("api/v1/audit/app_names", {params: $scope.params}).then((reply) => {
        $scope.app_names = reply.data;
    });

    $scope.search = function () {
        $scope.params.filter = semplify($scope.params.filter);
        $scope.params.sort = "-id";

        let params = JSON.parse(JSON.stringify($scope.params));

        if (params.filter.timestamp) {
            params.filter.timestamp.gte = new Date(params.filter.timestamp.gte);
            params.filter.timestamp.lte = new Date(params.filter.timestamp.lte);
            params.filter.timestamp.gte.setMinutes(params.filter.timestamp.gte.getMinutes() - params.filter.timestamp.gte.getTimezoneOffset());
            params.filter.timestamp.lte.setMinutes(params.filter.timestamp.lte.getMinutes() - params.filter.timestamp.lte.getTimezoneOffset());
        }


        $http.get("api/v1/audit/_page", {params:params}).then((reply) => {
            let audits = reply.data.list.reduce((r,e) => {
                if(!r[e.x_request_id]) r[e.x_request_id] = {};
                if(e.http_status) r[e.x_request_id].response = e; else r[e.x_request_id].request =  e;
                return r;
            }, {});

            $scope.audits = audits;

            $scope.totalPages = reply.data.total_pages;
            $scope.currentPage = reply.data.current_page;
            $scope.pageSize = reply.data.page_size;
            $scope.total_elements = reply.data.total_elements;
        });
    };

    $scope.succ = function () {
        $scope.params.offset += $scope.params.limit;
        $scope.search();
    };

    $scope.prec = function () {
        if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };


    function toJSON(x)
    {
        if(x == null) return null;

        if(typeof x == 'string') {
            try {
                return toJSON(JSON.parse(x));
            }
            catch(e){
                return x;
            }
        }

        if(Array.isArray(x))
        {
            return x.map(e => toJSON(e));
        }

        if(typeof x == 'object') return Object.keys(x).reduce((r, k) => {
            r[k] = toJSON(x[k]);
            return r;
        }, {})
        return x;
    }

    $scope.openModal = function (object){
        $scope.info = toJSON(object);
    }

    $scope.choose = function (numPage) {

        $scope.currentPage = numPage;
        $scope.params.offset = $scope.params.limit * (numPage -1);
        //if ($scope.params.offset > 0) $scope.params.offset -= $scope.params.limit;
        $scope.search();
    };
    $scope.search();
});