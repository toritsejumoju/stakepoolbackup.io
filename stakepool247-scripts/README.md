# Stakepool 24/7 script library

## Starting the scripts
### Prerequisites
* pm2 has to be installed
* yarn has to be installed
* node has to be installed
* git has to be installed
* ssh key access to https://github.com/stakepool247/stakepool247-scripts has to be granted

### Configuration
* clone the script repository (git clone https://github.com/stakepool247/stakepool247-scripts)
* edit file environment.sh to contain:
~~~
#!/bin/sh
export JSON_LOADER_CRON="*/10 * * * *"
export STATUS_MANAGER_CRON="3,8,13,18,23,28,33,38,43,48,53,58 * * * *"
export ROOT_DIR_POOL_JSON_LOADER=/var/stakepool247
export MAIL_NOTIF_RECIPIENT=info@stakepool247.eu
export POOLS_DATA_COLLECTION_ID=poolData
export GLOBAL_DATA_COLLECTION_ID=globalData
export STATUS_MANAGING_COLLECTION_ID=statusManaging
export EPOCHS_COLLECTION_ID=epochs
export DATA_API_KEY=...
export SERVER_MAIL_HOST=smtp.zoho.com
export SERVER_MAIL_PORT=465
export SERVER_MAIL_SECURE=true
export SERVER_MAIL_USER=support@stakepool247.eu
export SERVER_MAIL_PASS=...
export SERVER_MAIL_SENDER=pool-JSON-loader <support@stakepool247.eu>
~~~
* edit file firebase_service_account.json to contain the firebase service account credentials JSON:
~~~
{
        "type": "service_account",
        "project_id": "stakepool247-app",
        "private_key_id": "...",
        "private_key": "...",
        "client_email": "firebase-adminsdk-s88dq@stakepool247-app.iam.gserviceaccount.com",
        "client_id": "105182908767990023126",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-s88dq%40stakepool247-app.iam.gserviceaccount.com"
}
~~~
* Start / update the script with command:
~~~
cd stakepool247-scripts
./start.sh
~~~

## json-loader.js
Script for processing incoming pool-epoch data and pushing to Firestore DB.
Scheduled via a cron process.

#### Following environment variables must be configured:
#### REQUIRED: 
- ROOT_DIR_POOL_JSON_LOADER (points to directory containing inbox, archived, failed)
- MAIL_NOTIF_RECIPIENT (recipient email address for fail notifications)
- SERVICE_ACCOUNT_PRIVATE_KEY_JSON (Firebase service account private key file contents (exported json file contents))
- POOLS_DATA_COLLECTION_ID (Firebase appropriate collection id for storing pools data)
- STATUS_MANAGING_COLLECTION_ID (Firebase appropriate collection id for tracking pool data statuses)
- EPOCHS_COLLECTION_ID (Firebase appropriate collection id for storing each pools epochs data)
- DATA_API_KEY (BlockFrost API key = = project_id. MUST be defined in order to authenticate against Blockfrost servers (note that each network (mainnet/testnet) has its own project_id))
  
#### OPTIONAL: 
- JSON_LOADER_CRON (Cron expression for JSON loader schedule - defaults to "*/10 * * * *")
- SERVER_MAIL_SENDER (Sender for mail notifications - defaults to "pool-JSON-loader <pool-json-loader@localhost>")
- SERVER_MAIL_HOST (SMTP host - defaults to localhost)
- SERVER_MAIL_PORT (SMTP port - defaults to 25)
- SERVER_MAIL_SECURE (SMTP secure - defaults to false)
- SERVER_MAIL_USER (SMTP user email - defaults to empty)
- SERVER_MAIL_PASS (SMTP user password - defaults to empty)

## status-manager.js
Script for monitoring and updating statuses of existing slots in Firestore DB.
Scheduled via a cron process.

#### Following environment variables must be configured:
#### REQUIRED:
- SERVICE_ACCOUNT_PRIVATE_KEY_JSON (Firebase service account private key file contents (exported json file contents))
- POOLS_DATA_COLLECTION_ID = Firebase appropriate collection id for storing pools data
- GLOBAL_DATA_COLLECTION_ID (Firebase appropriate collection id for storing global data)
- STATUS_MANAGING_COLLECTION_ID (Firebase appropriate collection id for tracking pool data statuses)
- DATA_API_KEY (BlockFrost API key = project_id. MUST be defined in order to authenticate against Blockfrost servers (note that each network (mainnet/testnet) has its own project_id))

#### OPTIONAL:
- STATUS_MANAGER_CRON (Cron expression for status manager schedule - defaults to "3,8,13,18,23,28,33,38,43,48,53,58 * * * *")
