var fs = require('fs');

var uuid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

var cf = function (){
    let alfabeto = "ABCDEFGHILMNOPQRSTUVZ";
    let cf = "";
    for( let i =0 ; i < 6; i++) cf += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
    return cf;
}

var array = [];
let bulk_id = uuid();
for( let i=0; i<250000;i++){

    var payload = {
        "uuid" : uuid(),
        "payload": {
            "id": uuid(),
            "bulk_id": bulk_id,
            "user_id": cf(),
            "mex": {
                "title": "test case message",
                "body" : "test case message"
            },
            "email": {
                "subject":"subject email",
                "body":"body email"
            },
            "push": {
                "title":"Titolo push",
                "body":"corpo push"
            },
            "io":{  
               "time_to_live":3600,
               "content":{  
                  "subject":"Promemoria scadenza pagamento TARI - ACCONTO ATTIVITA' al 30/05/2019",
                  "markdown":"Il giorno 30/05/2019 scadra' il pagamento relativo a TARI - ACCONTO ATTIVITA' per un importo pari a 1260,00. \nE' possibile consultare la propria posizione dall'Estratto Conto Soris su http://www.soris.torino.it/cms/\nTutti gli altri canali di contatto e le modalita' di pagamento sono disponibili sul sito www.soris.torino.it",
                  "due_date":"2019-05-30T00:00:00"
               }
            },
            "memo":{  
               "allDay":true,
               "start":"2019-05-30T00:00:00+00:00",
               "timezone": "Europe/Rome",
               "summary":"Promemoria scadenza pagamento TARI - ACCONTO ATTIVITA' al 30/05/2019",
               "description":"Il giorno 30/05/2019 scadra' il pagamento relativo a TARI - ACCONTO ATTIVITA' per un importo pari a 1260,00. \nE' possibile consultare la propria posizione dall' Estratto Conto Soris su http://www.soris.torino.it/cms/\nTutti gli altri canali di contatto e le modalita' di pagamento sono disponibili sul sito www.soris.torino.it"
            }
        } 

    };

    array.push(payload)
}
  
fs.writeFileSync("dati.json",JSON.stringify(array,null,4),"utf-8")
