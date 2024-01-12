app.controller("client", function ($rootScope, $scope, $http, $location, $timeout, jwtHelper, $crypto) {


	
    var uuid = $location.search().service_uuid;
    $scope.channelsContent = {};

    let d = new Date();

    $scope.institutionTags = {
        model: null,
        availableOptions: [
            "",
            "csi_piem",
            "r_piemon",
            "c_l219"
        ]
    };


    $scope.token = {
        applications: {},
        exp: new Date(9999, 11, 31, 23, 59),
        iat: new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()),
        preferences: {}
    };

    getEnvVar();

    getServiceAndClient();


    async function getEnvVar() {
        try {
            let result = await $http.get("api/v1/environment_variables");
            $scope.environment_variables = result.data;
        } catch (error) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while get environment variables: " + error.data;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }
    }


    async function getServiceAndClient() {

        try {
            let result = await $http.get("api/v1/preferences/services/" + uuid);

            $scope.service = result.data ? result.data : {
                name: '',
                channels: [],
                uuid: uuid,
                tags: []
            };
            $scope.service.tags = $scope.service.tags? $scope.service.tags.join(",") : "";

            // if is a string it is converted to array
            $scope.service.channels = $scope.service.channels && $scope.service.channels != "" ? $scope.service.channels.split(",") : [];

            $scope.availableChannels = {
                "push": $scope.service.channels.includes("push"),
                "email": $scope.service.channels.includes("email"),
                "sms": $scope.service.channels.includes("sms"),
                "io": $scope.service.channels.includes("io")
            };

            let result2 = await $http.get("api/v1/preferences/services");
            $scope.listServices = $scope.service.name === "" ? result2.data.map(e => e.name) : [];


            let result3 = await $http.get("api/v1/clients/" + uuid);
            $scope.client = result3.data ? result3.data : {
                client_id: uuid,
                subscription_date: new Date().toISOString()
            };
            
            if ($scope.client.token_notify) {
                $scope.encrypted_token_notify = $scope.client.token_notify;
                let resultToken = await $http.get("api/v1/token/decrypt", {params: {token: $scope.client.token_notify}});
                $scope.client.token_notify = resultToken.data;
                $scope.token = jwtHelper.decodeToken($scope.client.token_notify);

                $scope.token.iat = new Date($scope.token.iat * 1000);
                $scope.token.exp = new Date($scope.token.exp * 1000);

                let applications = $scope.token.applications;
                $scope.token.applications = {};
                Object.keys(applications).forEach(application => {
                    $scope.token.applications[application] = {};
                    applications[application].forEach(permission => $scope.token.applications[application][permission] = true)
                });

                await $scope.calculateToken();

            }

        } catch (error) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while get service or client: " + error;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }
    }


    $scope.$watch("institutionTags.model", function (tag) {
        if (!$scope.service) return;
        if (!$scope.service.tags) $scope.service.tags = "";

        let tags = $scope.service.tags.split(",").filter(e => !$scope.institutionTags.availableOptions.includes(e));
        tags.push(tag);

        $scope.service.tags = tags.join(",");
    })


    $scope.showDivMessagge = false;


    $scope.saveAndSend = async function () {
        $scope.save();
        let listApplications = Object.keys($scope.token_info.applications);
        let mail = "Buongiorno,\n\n" +
            "è stato generato il token per il progetto: :service_name. \n\n" +
            "Il seguente token permette l'accesso :listaApi nell'ambiente di :environment :\n\n" +
            ":token \n\n" +
            "Mittenti delle canalità scelte:\n"
            + "Email: :sender_email\n"
            + "Push: :sender_push\n"
            + "Project Code del Gateway SMS: :sender_sms\n"
            + "Token IoItalia: :sender_ioitalia\n\n"
            + "E' responsabilità del progetto conservare il presente token JWT in una posizione sicura del client fruitore (websapp, app, altro client).\n\n"
            + "L'articolo. 5 del GDPR prevede che i dati debbano essere \"adeguati, pertinenti e limitati a quanto necessario rispetto alle finalità per le quali sono trattati\", non devono essere trattati dati non necessari rispetto alla finalità per la quale vengono raccolti e trattati.\n\n"
            + "Il client che sottomette notifiche deve rispettare il principio di minimizzazione che prevede che i dati utilizzati debbano essere limitati a quelli strettamente necessari rispetto allo scopo, in questo contesto devono essere limitati alle informazioni strettamente necessarie alla notifica di cortesia. La minimizzazione dei dati deve essere prevista fin dalla progettazione del trattamento (privacy by design e by default).\n\n"
            + "Nel caso sia stata attivata la canalità email si ricorda che è responsabilità del servizio indicare una mail mittente valida e registrata presso il provider. esempio mail: \"Sportello Facile\" <sportellofacile@torinofacile.it> \n\n"
            + "Se il gestore del servizio di posta è CSI-Piemonte è necessario che l'indirizzo sia correttamente censito. \n"
            + "Se il gestore del servizio di posta non è il CSI-Piemonte è necessario che il gestore esterno aggiunga al loro record SPF sul DNS i server CSI di uscita \"include:_spfmailfarmnet.csi.it\", questa condizione è necessaria affinché le mail siano correttamente recapitate all'utente. \n"
            + "La dimensione del messaggio di posta influisce suoi tempi di evasione dei messaggi a causa del tempo di calcolo della firma DKIM, si prega di minimizzare la grafica e il testo dei messaggi. \n\n"
            + "Questo messaggio e' stato generato automaticamente dalla piattaforma NOTIFY.\n";

        let listApis = {
            mb: "all'API sottomissione notifiche",
            preferences: "all'API di Preferenze",
            mex: "all'API di Message Store",
            events: "all'API di Messages Status"
        };
        mail = mail.replace(':service_name', $scope.service.name);

        let listaDiApi = "";

        for (let i = 1; i <= listApplications.length; i++) {
            listaDiApi += listApis[listApplications[i - 1]] + (listApplications.length === 1 || listApplications.length === i ? "" : (i + 1 < listApplications.length ? ", " : " e "));
        }
        mail = mail.replace(':listaApi', listaDiApi);
        mail = mail.replace(':environment', $rootScope.env.ENVIRONMENT);
        mail = mail.replace(':token', $scope.encrypted_token_notify);
        mail = mail.replace(':sender_email', ($scope.availableChannels.email ? $scope.token.preferences.email : "NON ATTIVO"));
        mail = mail.replace(':sender_push', ($scope.availableChannels.push ? $scope.token.preferences.push : "NON ATTIVO"));
        mail = mail.replace(':sender_sms', ($scope.availableChannels.sms ? JSON.stringify($scope.token.preferences.sms, null, 4) : "NON ATTIVO"));
        mail = mail.replace(':sender_ioitalia', ($scope.availableChannels.io ? $scope.token.preferences.io : "NON ATTIVO"));

        let subject = "Token per l'ambiente di " + $scope.environment_variables.ENVIRONMENT + " per il servizio " + $scope.service.name;

        $scope.email_to_send = {
            sender: "noreply.notify@csi.it",
            recipient: $scope.client.reference_email,
            cc: "marco.boero@csi.it",
            subject: subject,
            body: mail
        };

    };

    $scope.sendMail = function () {
        $http.post("api/v1/mail/send", $scope.email_to_send).then((result) => {
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "Email sent";
        }, (error) => {
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error sending email: " + JSON.stringify(error.data);
        });

    };

    $scope.save = async function () {
        try {
            if(!$scope.client.reference_email || $scope.client.reference_email.replace(/\s/g,"") === ""){
                throw {data: "Reference email is mandatory"};
            }
            $scope.client.preference_service_name = $scope.service.name;
            await $scope.calculateToken();
            $scope.service.channels = Object.keys($scope.availableChannels).filter(e => $scope.availableChannels[e] ? e.toLowerCase() : null);

            if ($scope.service.tags) $scope.service.tags = $scope.service.tags.split(",").map(e => e.trim().replace(/-/g, '_').replace(/\s/g, '_')).filter(e => e.length > 0).join(",");

            let client = Object.assign({},$scope.client);
            client.token_notify = $scope.encrypted_token_notify;
            client.subscription_date = client.subscription_date.replace("Z", "");
            client.subscription_date = client.subscription_date.replace("T", " ");

            /*var template = {
                template_name: $scope.template,
                template_src: btoa($scope.template_data)
            };
            await $http.post("api/v1/clients/template/email", template);*/

            let srv = $scope.service;
            srv.tags = srv.tags.split(",");

            await $http.put("api/v1/clients", client);
            await $http.put("api/v1/preferences/services", srv);
            $scope.$applyAsync();
            $scope.showDivMessagge = true;
            $scope.success = true;
            $scope.resultMessage = "client and service successfully created";
        } catch (error) {
            $scope.$applyAsync();
            $scope.showDivMessagge = true;
            $scope.success = false;
            $scope.resultMessage = "Error in client or service creation: " + JSON.stringify(error.data);
        }


    };

    $scope.calculateToken = async function () {

        $scope.token_info = {
            uuid: uuid,
            preference_service_name: $scope.service.name,
            exp: $scope.token.exp.getTime() / 1000,
            iat: $scope.token.iat.getTime() / 1000,
            applications: {},
            preferences: {}
        };


        Object.keys($scope.token.applications)
            .forEach(application =>
                $scope.token_info.applications[application] = Object.keys($scope.token.applications[application])
                    .filter(permission => $scope.token.applications[application][permission]).map(per => per));


        if (!$scope.token_info.applications.mex || $scope.token_info.applications.mex.length === 0) delete $scope.token_info.applications.mex;
        if (!$scope.token_info.applications.preferences || $scope.token_info.applications.preferences.length === 0) delete $scope.token_info.applications.preferences;
        if (!$scope.token_info.applications.mb || $scope.token_info.applications.mb.length === 0) delete $scope.token_info.applications.mb;

        let arrayChannelsChoosed = Object.keys($scope.availableChannels).map(e => {
            if ($scope.availableChannels[e]) {
                e.toLowerCase();
                return e;
            }
        });

        $scope.token_info.preferences = {};
        arrayChannelsChoosed.forEach(e => $scope.token_info.preferences[e] = $scope.token.preferences[e]);

        try {
            let result = await $http.get("api/v1/clients/" + uuid + "/token", {params: {payload: $scope.token_info}});
            $scope.client.token_notify = result.data ? result.data : "";
            let result2 = await $http.get("api/v1/token/crypt", {params: {token: $scope.client.token_notify}});
            $scope.encrypted_token_notify = result2.data;
        }catch (error) {
            $scope.showDivMessagge = true;
            $scope.success = false;
            let errorMessage = "Error while getting client: " + error;
            $scope.resultMessage = $scope.resultMessage ? $scope.resultMessage + "<br/>" + errorMessage : errorMessage;
        }


    }


    async function cryptToken(token) {
        let crypted_token = await $http.get("api/v1/token/crypt", {params: {token: token}});
        return crypted_token.data;
    }

    async function decryptToken(token) {
        let decrypted_token = await $http.get("api/v1/token/decrypt", {params: {token: token}});
        return decrypted_token.data;
    }
    
    
    $scope.startUpload = function() {
        var f = document.getElementById('file').files[0],
            r = new FileReader();
        $scope.template = $scope.service.name +"-template.html";
        var deleteTemplate = document.getElementById('deleteTemplate');
        deleteTemplate.style.display = "inline";
        r.onloadend = function(e){
            $scope.template_data = e.target.result;
        }
        /*r.onloadend = function(e) {
          var data = e.target.result;
          var template = {
        		  template_name: templateName,
                  template_src: btoa(data)
              };
          $http.post("api/v1/clients/template/email", template).then((result) => {
              $scope.showDivMessagge = true;
              $scope.success = true;
              $scope.resultMessage = "template email added";
          }, (error) => {
              $scope.showDivMessagge = true;
              $scope.success = false;
              $scope.resultMessage = "Error adding template email: " + JSON.stringify(error.data);
          });


          //send your binary data via $http or $resource or do anything else with it
        }*/

        r.readAsBinaryString(f);
    }
    
    var inputs = document.querySelectorAll( '.inputfile' );
    Array.prototype.forEach.call( inputs, function( input )
    {
    	var label	 = input.nextElementSibling,
    		labelVal = label.innerHTML;

    	input.addEventListener( 'change', function( e )
    	{
    		var fileName = '';
    		if( this.files && this.files.length > 1 )
    			fileName = ( this.getAttribute( 'data-multiple-caption' ) || '' ).replace( '{count}', this.files.length );
    		else
    			fileName = e.target.value.split( '\\' ).pop();

    		if( fileName )
    			label.querySelector( 'span' ).innerHTML = fileName;
    		else
    			label.innerHTML = labelVal;
    	});
    });
   

    $scope.download = async function() {
    	let templateName = $scope.service.name +"-template.html"
    	let result4 = await $http.get("api/v1/clients/template/email/"+templateName);
    	var b64Data = result4.data ;
    	var dlnk = document.getElementById('dwnldLnk');
        dlnk.href = "data:application/octet-stream;base64,"+b64Data;
        dlnk.download= templateName;
        dlnk.click();

    }
    
    $scope.deleteTemplate = async function() {
    	let templateName = $scope.service.name +"-template.html";
    	$http.delete("api/v1/clients/template/email/"+templateName).then((result) => {
	      	  $scope.template = "";
	      	  var deleteTemplate = document.getElementById('deleteTemplate');
	      	  deleteTemplate.style.display = "none"; 
	          $scope.showDivMessagge = true;
	          $scope.success = true;
	          $scope.resultMessage = "template email deleted";
	      }, (error) => {
	          $scope.showDivMessagge = true;
	          $scope.success = false;
	          $scope.resultMessage = "Error deleting template email: " + JSON.stringify(error.data);
	      });
    }
});
