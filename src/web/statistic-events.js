app.controller("statistic-events", function ($scope, $http, $filter, $location) {
    $scope.lte = new Date();
    $scope.gte = new Date();


    $scope.set_dates = function(k, n)
    {
        let d1 = new Date();
        d1.setDate(d1.getDate() - n);
        $scope.lte = d1;
        let d2 = new Date();
        d2.setDate(d2.getDate() - k);
        $scope.gte = d2;
        $scope.search();
    }



    $scope.goToEvents = function(value, t) {
        var filter = {};

        let lte = new Date($scope.lte);
        lte.setHours(23);
        lte.setMinutes(59);
        lte.setSeconds(0);
        lte.setMilliseconds(0)
        let gte = new Date($scope.gte);
        gte.setHours(0);
        gte.setMinutes(0);
        gte.setSeconds(0);
        gte.setMilliseconds(0)
        filter.created_at = {
            lte: lte,
            gte: gte
        };

        filter.source = {
            eq : value.source
        }

        filter.type = {
            eq : t
        }
        filter.payload = {
            ci : value.sender
        }
        filter.tenant = {
            eq : value.tenant
        }
        $scope.go('events',{
            filter: filter
        });
    }

    $scope.search = function () {

        var params = {
            filter: {
                date: {
                    lte: $filter('date')($scope.lte, "yyyyMMdd"),
                    gte: $filter('date')($scope.gte, "yyyyMMdd")
                }
            }
        }
        $http.get("api/v1/statistic/stats", {params: params}).then((result => {


            $scope.statistic = result.data;
            $scope.types = Array.from($scope.statistic.map(e => e.type.toUpperCase()).reduce((result, e) => {
                result.add(e);
                return result;
            }, new Set())).sort();
            $scope.statistic = $scope.statistic
                .reduce((r, e) => {
                    let k = [e.sender + "-" + e.source];
                    if (!r[k]) r[k] = {
                        "tenant": e.tenant,
                        "sender": e.sender,
                        "source": e.source,
                        "types": {}
                    }
                    r[k].types[e.type.toUpperCase()] = e.counter;
                    return r;
                }, {});

            $scope.statistic = Object.values($scope.statistic)
                .map(e => {
                    $scope.types.forEach(t => {
                        if (!e.types[t]) e.types[t] = 0
                    });
                    return e;
                })

        }), ((error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting success messages: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }));

    }

    $scope.historicize = function(stat){
        stat.date = {
            lte: $filter('date')($scope.lte, "yyyyMMdd"),
            gte: $filter('date')($scope.gte, "yyyyMMdd")
        };
        $http.post("api/v1/statistic/historicize", stat)
            .then((result => {
                    $scope.search();
                }),
                ((error) => {
                    $scope.showDivMessagge = true;
                    $scope.success = false;
                    $scope.resultMessage = "Error in historicize: " + JSON.stringify(error.data);
                }));
    }

    $scope.search();
});