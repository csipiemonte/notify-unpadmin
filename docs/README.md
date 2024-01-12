# Introduzione

*unpadmin* è il portale web per la gestione dei servizi e per il monitoraggio della piattaforma.

# Getting Started

Per rendere operativo il sistema occorre:
1. creare lo schema sul database con lo script `dbscript/unpadmin.sql`.
1. impostare gli opportuni valori delle variabili d'ambiente
1. editare il file di configurazione
1. avviare l'applicazione

## Prerequisites

* Istanza attiva di PostgreSQL
* Istanza di [Redis](https://redis.io/) attiva e in ascolto sulla porta impostata sulla conf (o quella di default, 6379, se omessa)

## Configuration

La configurazione è basata su variabili d'ambiente e file di configurazione. Una variabile può essere presente sia su variabile d'ambiente che nel file di conf specifico dell'ambiente che nel file di conf generico della componente. All'avvio della comopnente viene effettuato il merge di questi tre entry point. Le variabili se prensenti in più punti (file o env) vengono gestite con la seguente priorità (dalla più alta alla più bassa):
* variabile d'ambiente
* file di conf specifico dell'ambiente
* file di conf generico della componente

Le variabili d'ambiente da valorizzare sono:
* `ENVIRONMENT`: rappresenta l'ambiente di esecuzione (ad esempio dev, tst o prod). Serve per individuare il file di configurazione secondario.

I file di configurazione sono `conf/unp-admin.json` e`conf/unp-admin-{ENVIRONMENT}.json`. Ove lo stesso parametro sia presente su entrambi i file il valore in `conf/unp-admin-{ENVIRONMENT}.json` ha la precedenza.

I principali attributi presenti nei file di configurazione sono elencati di seguito (per l'elenco completo visualizzare il contenuto dei file presenti nella cartella src/conf):

* `app_name` : nome dell'applicazione (obbligatorio per tracciatura degli eventi e check sicurezza)
* `server_port`: porta che utilizzerà l'istanza del server
* `mail`: configurazione per invio mail
    * `server`: informazioni sul server smtp
        * `host`: host del server smtp
        * `port`: porta del server smtp
* `mb`: contiene la configurazione per il Message Broker.
    * `queues`: contiene le informazioni per le code del message broker
        * `messages`: url della coda su cui scrivere i messaggi
    * `token`: il token auth per chiamare il message broker
* `security`: contiene la configurazione della sicurezza
    * `secret`: password per verificare firma del token auth utilizzato per chiamare la comopnente
    * `passphrase`: password usata per cifrare/decifrare dati sul db
* `db`: contiene la configurazione per la connessione al database.
    * `unpadmin`: configurazioni per colelgarsi allo schema unpadmin
        * `host`: l'hostname del dbms
        * `database`: il nome del database a cui accedere
        * `user`: utente con cui accedere al db
        * `password`: password dell'utente del db
        * `schema`: database schema
    * `preferences`: configurazioni per colelgarsi allo schema unppreferences
        * `host`: l'hostname del dbms
        * `database`: il nome del database a cui accedere
        * `user`: utente con cui accedere al db
        * `password`: password dell'utente del db
        * `schema`: database schema
    * `events`: configurazioni per colelgarsi allo schema unpevents
        * `host`: l'hostname del dbms
        * `database`: il nome del database a cui accedere
        * `user`: utente con cui accedere al db
        * `password`: password dell'utente del db
        * `schema`: database schema
    * `audit`: configurazioni per colelgarsi allo schema unpaudit
        * `host`: l'hostname del dbms
        * `database`: il nome del database a cui accedere
        * `user`: utente con cui accedere al db
        * `password`: password dell'utente del db
        * `schema`: database schema
    * `mex`: configurazioni per colelgarsi allo schema unpmex
        * `host`: l'hostname del dbms
        * `database`: il nome del database a cui accedere
        * `user`: utente con cui accedere al db
        * `password`: password dell'utente del db
        * `schema`: database schema
* `log4js`: la configurazione di log4js (vedi https://www.npmjs.com/package/log4js)
* `monitoring`: configurazioni per moniotraggio
    * `hosts`: host da monitorare
    * `master_hosts`: master host che eseguono alcune attività schedulate

# Running

Avviare unpadmin server 
```
cd src && node unpadmin.js
```

or

```
npm start
```

Una volta avviato collegarsi a [http://localhost:9091](http://localhost:9091)