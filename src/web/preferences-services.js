app.controller("preferences-services", function ($scope, $http) {

    $scope.showDivMessagge = false;
    $scope.addServicesButtonEnabled = false;
    $scope.servicesToImport = [];
    

    $scope.list = [];

    getServicesList();
    async function getServicesList() {
        $http.get("api/v1/preferences/services").then(result => {
            $scope.list = result.data.map(e => { e.tags = e.tags.join(","); return e;});
            $scope.showDivMessagge = false;
            $scope.success = true;
        }).catch(error => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting list of services: " + error.status + " " + error.statusText;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        });
    }

    $scope.refresh = async function(){
        getServicesList();
        $scope.showAddServicesMessagge = false;
        $scope.addServicesSuccess = true;
        $scope.addServicesMessage = "";
        $scope.servicesToImport = [];
        $scope.$applyAsync();
    }

    $scope.params =
        {
            filter: {},
            sort: "+service_name",
            limit: 10,
            offset: 0
        };

    $scope.upload = function(){
        let r = new FileReader();
        r.onloadend = async function(e){
            let services_data = e.target.result;
            let servicesArrays = CSVToArray(services_data);
            $scope.addServicesButtonEnabled = true;

            let servicesObj = [];
            servicesArrays.forEach(function(serviceToImport) {
                let serviceObj = {};
                if(serviceToImport[0] && serviceToImport[1]) {
                    serviceObj.status = "";
                } else {
                    serviceObj.status = "active";
                    $scope.addServicesButtonEnabled = false;
                }
                serviceObj.uuid = uuid();
                serviceObj.service_name = serviceToImport[0]? serviceToImport[0].trim() : serviceToImport[0];
                serviceObj.reference_email = serviceToImport[1];
                serviceObj.tags = serviceToImport[2]? serviceToImport[2].trim() : serviceToImport[2];
                serviceObj.notes = serviceToImport[3]? serviceToImport[3].trim() : serviceToImport[3];
                serviceObj.agent_auth = (serviceToImport[4] && serviceToImport[4].toLowerCase() === 'true');
                serviceObj.mb_enqueue = (serviceToImport[5] && serviceToImport[5].toLowerCase() === 'true');
                serviceObj.mb_dequeue = (serviceToImport[6] && serviceToImport[6].toLowerCase() === 'true');
                serviceObj.pref_read = (serviceToImport[7] && serviceToImport[7].toLowerCase() === 'true');
                serviceObj.pref_write = (serviceToImport[8] && serviceToImport[8].toLowerCase() === 'true');
                serviceObj.pref_admin = (serviceToImport[9] && serviceToImport[9].toLowerCase() === 'true');
                serviceObj.mex_read = (serviceToImport[10] && serviceToImport[10].toLowerCase() === 'true');
                serviceObj.mex_write = (serviceToImport[11] && serviceToImport[11].toLowerCase() === 'true');
                serviceObj.mex_admin = (serviceToImport[12] && serviceToImport[12].toLowerCase() === 'true');
                serviceObj.events_read = (serviceToImport[13] && serviceToImport[13].toLowerCase() === 'true');
                serviceObj.events_write = (serviceToImport[14] && serviceToImport[14].toLowerCase() === 'true');
                serviceObj.events_admin = (serviceToImport[15] && serviceToImport[15].toLowerCase() === 'true');
                serviceObj.push_token = serviceToImport[16]? serviceToImport[16].trim() : serviceToImport[16];
                serviceObj.email_sender = serviceToImport[17]? serviceToImport[17].trim() : serviceToImport[17];
                serviceObj.sms_prj_code = serviceToImport[18]? serviceToImport[18].trim() : serviceToImport[18];
                serviceObj.sms_username = serviceToImport[19]? serviceToImport[19].trim() : serviceToImport[19];
                serviceObj.sms_password = serviceToImport[20]? serviceToImport[20].trim() : serviceToImport[20];
                serviceObj.io_token = serviceToImport[21]? serviceToImport[21].trim() : serviceToImport[21];

                servicesObj.push(serviceObj);
            });

            $scope.servicesToImport = servicesObj;
            $scope.$applyAsync();
        }
        r.readAsBinaryString($scope.services_file);
    }

    $scope.addServices = async function () {
        try {
            $scope.addServicesButtonEnabled = false;
            $scope.$applyAsync();
            for(const service of $scope.servicesToImport) {
                
                // get the service jwt token 
                let notify_token = await calculateToken(service);
                if(notify_token === null) {
                    service.status = "warning";
                    continue;
                }
                service.notify_token = notify_token.encrypted_token;

                // clear tags
                if(service.tags) service.tags = service.tags.split(",").map(e => e.trim().replace(/-/g, '_').replace(/\s/g, '_')).filter(e => e.length > 0).join(",");

                // create the client
                try {
                    let client = {};
                    client.client_id = notify_token.payload.uuid;
                    client.notes = service.notes? service.notes : null;
                    client.preference_service_name = service.service_name;
                    client.reference_email = service.reference_email;
                    let subscription_date = new Date(notify_token.payload.iat * 1000);
                    client.subscription_date = subscription_date.toJSON().replace("Z", "").replace("T", " ");
                    client.token_notify = notify_token.encrypted_token;
                
                    await $http.put("api/v1/clients", client);
                } catch(err) {
                    service.status = "warning";
                    continue;
                }

                // create the service
                try {
                    let availableChannels=[];
                    if(service.email_sender) availableChannels.push('email');
                    if(service.push_token) availableChannels.push('push');
                    if(service.io_token) availableChannels.push('io');
                    if(service.sms_prj_code && service.sms_username && service.sms_password) availableChannels.push('sms');

                    let srv = {};
                    srv.uuid = notify_token.payload.uuid;
                    srv.name = service.service_name;
                    // srv.description = service.notes;
                    srv.tags = service.tags.split(",");
                    srv.channels = availableChannels;

                    await $http.put("api/v1/preferences/services", srv);
                } catch(err) {
                    service.status = "danger";
                    continue;
                }
                
                service.status = "success";
            }
            $scope.showAddServicesMessagge = true;
            $scope.addServicesSuccess = true;
            $scope.addServicesMessage = "Add services process ended, check each line to see the result.";
            $scope.$applyAsync();
        } catch (error) {
            $scope.showAddServicesMessagge = true;
            $scope.addServicesSuccess = false;
            $scope.addServicesMessage = "Error adding services from file: " + JSON.stringify(error);
            $scope.$applyAsync();
        }
    };

    async function calculateToken (service) {

        var auth_token = {};

        var d = new Date();
        var iat_time = Math.floor(d.getTime() / 1000);
        var exp_time = Math.floor(Date.parse("9999-12-31T23:59:59") / 1000);

        let token_info = {
            uuid: service.uuid,
            preference_service_name: service.service_name,
            exp: exp_time,
            iat: iat_time,
            applications: {},
            preferences: {}
        };

        if(service.agent_auth) {
            token_info.agent_auth = service.agent_auth;
        }

        // set applications permissions
        if(service.mb_enqueue || service.mb_dequeue ) {
            token_info.applications.mb = [];
            if(service.mb_enqueue) token_info.applications.mb.push("enqueue");
            if(service.mb_dequeue) token_info.applications.mb.push("dequeue");
        }
        if(service.mex_read || service.mex_write || service.mex_admin) {
            token_info.applications.mex = [];
            if(service.mex_read) token_info.applications.mex.push("read");
            if(service.mex_write) token_info.applications.mex.push("write");
            if(service.mex_admin) token_info.applications.mex.push("admin");
        }
        if(service.pref_read || service.pref_write || service.pref_admin) {
            token_info.applications.preferences = [];
            if(service.pref_read) token_info.applications.preferences.push("read");
            if(service.pref_write) token_info.applications.preferences.push("write");
            if(service.pref_admin) token_info.applications.preferences.push("admin");
        }
        if(service.events_read || service.events_write || service.events_admin) {
            token_info.applications.events = [];
            if(service.events_read) token_info.applications.events.push("read");
            if(service.events_write) token_info.applications.events.push("write");
            if(service.events_admin) token_info.applications.events.push("admin");
        }

        // set channels settings
        if(service.email_sender) token_info.preferences.email = service.email_sender;
        if(service.push_token) token_info.preferences.push = service.push_token;
        if(service.io_token) token_info.preferences.io = service.io_token;
        if(service.sms_prj_code && service.sms_username && service.sms_password) {
            token_info.preferences.sms = {};
            token_info.preferences.sms.project_code = service.sms_prj_code;
            token_info.preferences.sms.username = service.sms_username;
            token_info.preferences.sms.password = service.sms_password;
        }

        auth_token.payload = token_info;

        try {
            let jwt_token_signed = await $http.get("api/v1/clients/" + service.uuid + "/token", {params: {payload: token_info}});
            auth_token.signed_token = jwt_token_signed.data;
            
            let jwt_token_encrypted = await $http.get("api/v1/token/crypt", {params: {token: jwt_token_signed.data}});
            auth_token.encrypted_token = jwt_token_encrypted.data;
            
            return auth_token;
        } catch (error) {
            return null;
        }
    }

    function CSVToArray( strData, strDelimiter ){
        // Check to see if the delimiter is defined. If not,
        // then default to comma.
        strDelimiter = (strDelimiter || ",");

        // Create a regular expression to parse the CSV values.
        let objPattern = new RegExp(
            (
                // Delimiters.
                "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

                // Quoted fields.
                "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

                // Standard fields.
                "([^\"\\" + strDelimiter + "\\r\\n]*))"
            ),
            "gi"
            );


        // Create an array to hold our data. Give the array
        // a default empty first row.
        let arrData = [[]];

        // Create an array to hold our individual pattern
        // matching groups.
        let arrMatches = null;


        // Keep looping over the regular expression matches
        // until we can no longer find a match.
        while (arrMatches = objPattern.exec( strData )){

            // Get the delimiter that was found.
            let strMatchedDelimiter = arrMatches[ 1 ];

            // Check to see if the given delimiter has a length
            // (is not the start of string) and if it matches
            // field delimiter. If id does not, then we know
            // that this delimiter is a row delimiter.
            if (
                strMatchedDelimiter.length &&
                strMatchedDelimiter !== strDelimiter
                ){

                // Since we have reached a new row of data,
                // add an empty row to our data array.
                arrData.push( [] );

            }

            let strMatchedValue;

            // Now that we have our delimiter out of the way,
            // let's check to see which kind of value we
            // captured (quoted or unquoted).
            if (arrMatches[ 2 ]){

                // We found a quoted value. When we capture
                // this value, unescape any double quotes.
                strMatchedValue = arrMatches[ 2 ].replace(
                    new RegExp( "\"\"", "g" ),
                    "\""
                    );

            } else {

                // We found a non-quoted value.
                strMatchedValue = arrMatches[ 3 ];

            }


            // Now that we have our value string, let's add
            // it to the data array.
            arrData[ arrData.length - 1 ].push( strMatchedValue );
        }

        // Return the parsed data.
        return( arrData );
    }

    $scope.downloadTemplate = function(){
        let data = '"service_name","reference_email","tags","notes","agent_auth","mb_enqueue","mb_dequeue","pref_read","pref_write","pref_admin","mex_read","mex_write","mex_admin","events_read","events_write","events_admin","push_token","email_sender","sms_prj_code","sms_username","sms_password","io_token"';
        const blob = new Blob([data], { type: 'text/csv' });
        const url= window.URL.createObjectURL(blob);
        var anchor = document.createElement("a");
        anchor.download = "add_services_template.csv";
        anchor.href = url;
        anchor.click();
        // window.open(url);
    }

    $scope.downloadReport = function(){
        
        try {
            let output_file_name = "add_services_report_" + new Date().toISOString().
                replace(/T|\:|\-/g, '').      // remove T, colon (:) and dash (-)
                replace(/\..+/, '') +    // delete the dot and everything after
                ".csv";
            
            var fields = Object.keys($scope.servicesToImport[0]);
            var replacer = function(key, value) { return value === null ? '' : value } 
            var csv = $scope.servicesToImport.map(function(row){
                return fields.map(function(fieldName){
                return JSON.stringify(row[fieldName], replacer)
                }).join(',')
            })
            csv.unshift(fields.join(',')) // add header column
                csv = csv.join('\r\n');
        
            const blob = new Blob([csv], { type: 'text/csv' });
            const url= window.URL.createObjectURL(blob);
            var anchor = document.createElement("a");
            anchor.download = output_file_name;
            anchor.href = url;
            anchor.click();
        } catch (err) {
            console.error("Error creating report file.", err);
        }
    }

});
