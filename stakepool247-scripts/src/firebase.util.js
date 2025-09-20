const admin = require("firebase-admin");

/**
 * Program uses env variables:
 *      REQUIRED:
 *          SERVICE_ACCOUNT_PRIVATE_KEY_JSON (Firebase service account private key file contents)
 *          POOLS_DATA_COLLECTION_ID (Firebase appropriate collection id for storing pools data)
 *          GLOBAL_DATA_COLLECTION_ID (Firebase appropriate collection id for storing global data)
 *          STATUS_MANAGING_COLLECTION_ID (Firebase appropriate collection id for tracking pool data statuses)
 *          EPOCHS_COLLECTION_ID (Firebase appropriate collection id for storing each pools epochs data)
 */

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_PRIVATE_KEY_JSON))
});
admin.firestore().settings({ ignoreUndefinedProperties: true });

if (! ('SERVICE_ACCOUNT_PRIVATE_KEY_JSON' in process.env)) throw new Error("DATA_COLLECTION_ID must be set");
if (! ('POOLS_DATA_COLLECTION_ID' in process.env)) throw new Error("POOLS_DATA_COLLECTION_ID must be set");
if (! ('GLOBAL_DATA_COLLECTION_ID' in process.env)) throw new Error("GLOBAL_DATA_COLLECTION_ID must be set");
if (! ('STATUS_MANAGING_COLLECTION_ID' in process.env)) throw new Error("STATUS_MANAGING_COLLECTION_ID must be set");
if (! ('EPOCHS_COLLECTION_ID' in process.env)) throw new Error("EPOCHS_COLLECTION_ID must be set");

const db = admin.firestore('stakepool247-v2');
const GLOBAL_DATA_COLLECTION_ID = process.env.GLOBAL_DATA_COLLECTION_ID;
const POOLS_DATA_COLLECTION_ID = process.env.POOLS_DATA_COLLECTION_ID;
const STATUS_MANAGING_COLLECTION_ID = process.env.STATUS_MANAGING_COLLECTION_ID;
const EPOCHS_COLLECTION_ID = process.env.EPOCHS_COLLECTION_ID;

module.exports = {
    db: function () {
        return db;
    },
    poolsData: function () {
        return POOLS_DATA_COLLECTION_ID;
    },
    poolsDataCollectionRef: function () {
        return db.collection(POOLS_DATA_COLLECTION_ID);
    },
    globalDatCollectionRef: function () {
        return db.collection(GLOBAL_DATA_COLLECTION_ID);
    },
    statusManagingDocRef: function () {
        return db.collection(STATUS_MANAGING_COLLECTION_ID).doc(STATUS_MANAGING_COLLECTION_ID);
    },
    epochsData: function () {
        return EPOCHS_COLLECTION_ID;
    },
    deleteValue: function () {
        return admin.firestore.FieldValue.delete();
    },
    transaction: async function (docRef, callback) {
        return db.runTransaction(async (t) => {
            return callback(t);
        }).then((res) => { 
            console.log(new Date().toISOString() + "|  Transaction successful for document %s", docRef.path);
            return res;
        }).catch((err) => console.error(new Date().toISOString() + "|  Transaction failed for document %s, error: %s", docRef.path, err));
    }
};
