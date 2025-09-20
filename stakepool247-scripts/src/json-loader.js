const fs = require("fs");
const path = require("path");
const { bech32 } = require("bech32");
const dbUtil = require("./firebase.util.js");
const apiUtil = require("./data-api.util.js");
const mailerUtil = require("./mailer.util.js");
const cron = require("node-cron");

/**
 * Program uses env variables:
 *      REQUIRED:
 *          ROOT_DIR_POOL_JSON_LOADER (points to directory containing inbox, archived, failed)
 *      OPTIONAL:
 *          JSON_LOADER_CRON (Cron expression for JSON loader schedule - defaults to "*\/10 * * * *")
 */
function validateEpoch(epoch) {
    if (!(epoch.epoch !== undefined
            && epoch.epochSlots !== undefined
            && epoch.epochSlotsIdeal !== undefined
            && epoch.maxPerformance !== undefined
            && epoch.poolId !== undefined
            && epoch.activeStake !== undefined
            && epoch.totalActiveStake !== undefined
            && epoch.assignedSlots !== undefined)) {
        throw new Error("Invalid epoch dataset recieved");
    }
}

function validSlot(slot) {
    return slot.no !== undefined
            && slot.slot !== undefined
            && slot.slotInEpoch !== undefined
            && slot.at !== undefined;
}

const getDirectories = function (source) {
    return fs.readdirSync(source, {withFileTypes: true})
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .map((name) => path.join(source, name));
};

const getFiles = function (source) {
    return fs.readdirSync(source, {withFileTypes: true})
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((filename) => filename.match(/.+\.json$/))
    .map((name) => path.join(source, name));
};

const moveFile = function (filePath, ticker, failed, reason, failedDir, archiveDir, inboxDir) {
    const components = filePath.split("/");
    const lastIndex = components.length - 1;
    if (failed) {
        const failedFileName = components[lastIndex];
        const failedFilePath = inboxDir.concat("/").concat(components[lastIndex - 1]).concat("/").concat(failedFileName).concat(".failed");
        if (!fs.existsSync(path.toNamespacedPath(failedFilePath))) {
            fs.writeFileSync(path.toNamespacedPath(failedFilePath), "1", {flag: "w"});
        } else {
            const failedTimes = parseInt(fs.readFileSync(path.toNamespacedPath(failedFilePath)).toString());
            if (failedTimes >= 3) {
                const targetFailDirName = failedDir.concat("/").concat(components[lastIndex - 1]);
                fs.mkdirSync(path.toNamespacedPath(targetFailDirName), {recursive: true});
                fs.copyFileSync(filePath, targetFailDirName.concat("/").concat(failedFileName));
                fs.rmSync(path.toNamespacedPath(filePath), {force: true});
                fs.rmSync(path.toNamespacedPath(failedFilePath), {force: true});
                const info = ["FileName: " + failedFileName, "Pool ticker: " + ticker, "Epoch: " + components[lastIndex - 1], "Reason: " + reason];
                mailerUtil.sendMail(
                            "FAILED json processing: ".concat(components[lastIndex - 1]).concat("/").concat(failedFileName),
                            "<span>" + info + "</span>",
                            "pool-JSON-loader",
                            info);
            } else {
                // increment retry times
                fs.writeFileSync(path.toNamespacedPath(failedFilePath), (failedTimes + 1).toString());
            }
        }
    } else {
        console.info(new Date().toISOString() + "|  Successfully parsed and pushed file: %s", filePath); // at this point it already is pushed to DB
        const successFileName = formatDate(new Date()).concat("_").concat(components[lastIndex]);
        const targetDirName = archiveDir.concat("/").concat(components[lastIndex - 1]);
        fs.mkdirSync(path.toNamespacedPath(targetDirName), {recursive: true});
        fs.copyFileSync(filePath, targetDirName.concat("/").concat(successFileName));
        fs.rmSync(path.toNamespacedPath(filePath), {force: true});
    }
};

const pushEpochData = async function (epochJson, tTicker, poolStatusData, plannedSlotsList, t) { // publishing to DB
    const pPoolIdBech32 = epochJson.poolIdBech32;
    const eEpoch = epochJson.epoch;
    
    return await getPoolStakeAddress(pPoolIdBech32, tTicker, eEpoch).then(async function (pPoolStakeAddress) {
        poolStatusData.poolStakeAddress = pPoolStakeAddress !== undefined;
        
        const refDataPoolDoc = dbUtil.poolsDataCollectionRef().doc(pPoolIdBech32);
        const refDataEpochDoc = refDataPoolDoc.collection(dbUtil.epochsData()).doc(eEpoch + "");
        
        return await refDataPoolDoc.create({ ticker: tTicker, poolStakeAddress: pPoolStakeAddress, poolId: epochJson.poolId, poolIdBech32: pPoolIdBech32, owner: "", allowRead: [], status: poolStatusData })
            .then(async () => refDataEpochDoc.set(epochJson) // "Epochs" sub-collection:
                .then(async () => await initializeEpochStatus(pPoolIdBech32, eEpoch, plannedSlotsList, t))
                .catch((err) => {
                    console.error(new Date().toISOString() + "|  Writing to document failed. Document path: %s. Err: %s", refDataEpochDoc.path, err);
                    return {
                        failed: true,
                        reason: "Writing to document failed. Document path: ".concat(refDataEpochDoc.path).concat(", Err: ").concat(err)
                    };
                })
            ).catch(async () => 
                await refDataPoolDoc.update({ ticker: tTicker, poolStakeAddress: pPoolStakeAddress, poolId: epochJson.poolId, poolIdBech32: pPoolIdBech32, status: poolStatusData })
                .then(async () => await refDataEpochDoc.set(epochJson, { merge: true }) // "Epochs" sub-collection:
                    .then(async () => await initializeEpochStatus(pPoolIdBech32, eEpoch, plannedSlotsList, t))
                    .catch((err) => {
                        console.error(new Date().toISOString() + "|  Writing to document failed. Document path: %s. Err: %s", refDataEpochDoc.path, err);
                        return {
                            failed: true,
                            reason: "Writing to document failed. Document path: ".concat(refDataEpochDoc.path).concat(", Err: ").concat(err)
                        };
                    })).catch((err) => { 
                    console.error(new Date().toISOString() + "|  Writing to document failed. Document path: %s. Err: %s", refDataPoolDoc.path, err);
                    return {
                        failed: true,
                        reason: "Writing to document failed. Document path: ".concat(refDataPoolDoc.path).concat(", Err: ").concat(err)
                    };
                })
            );
    }).catch((err) => {
        console.error(new Date().toISOString() + "|  Failed to retrieve data from API for poolStakeAddress (poolIdBech: %s), error: %s", pPoolIdBech32, err);
        return {
            failed: true,
            reason: "Failed to retrieve data from API for poolStakeAddress (poolIdBech: ".concat(pPoolIdBech32).concat("), error: ").concat(err)
        };
    });
};

const initializeEpochStatus = async function (poolIdBech32, epoch, plannedSlotsList, t) {
    const refStatusManagingDoc = dbUtil.statusManagingDocRef();
    const epochDocRef = dbUtil.poolsData().concat("/").concat(poolIdBech32).concat("/epochs/").concat(epoch);

    console.info(new Date().toISOString() + "|  Retrieving status doc");
    return await t.get(refStatusManagingDoc).then(async (statusManagingDoc) => {
        const data = statusManagingDoc.data();

        const uUpcomingSlots = data.upcomingSlots;
        console.info(new Date().toISOString() + "|  Status doc retrieved\n Upcoming slots: %s", uUpcomingSlots)
        console.info(new Date().toISOString() + "|  (pool: %s, epoch: %s) Merging with new planned slots\n Adding: %s", poolIdBech32, epoch, plannedSlotsList)

        for (let s of Object.keys(uUpcomingSlots)) {
            if (uUpcomingSlots[s] === epochDocRef) {
                uUpcomingSlots[s] = dbUtil.deleteValue();
            }
        }

        plannedSlotsList.forEach((slot) => uUpcomingSlots[slot] = epochDocRef);
        console.info(new Date().toISOString() + "|  (pool: %s, epoch: %s) Slots after merge: %s ", poolIdBech32, epoch, uUpcomingSlots)
        
        const rewardsStatusKey = poolIdBech32.concat("_EPOCH_").concat(epoch);
        const mMissingPoolRewardsPoolEpochs = data.missingPoolRewardsPoolEpochs;
        mMissingPoolRewardsPoolEpochs[rewardsStatusKey] = epochDocRef;
        
        try {
            console.info(new Date().toISOString() + "|  (pool: %s, epoch: %s) Writing new slots to doc: %s", poolIdBech32, epoch, uUpcomingSlots)
            await t.set(refStatusManagingDoc, {upcomingSlots: uUpcomingSlots, missingPoolRewardsPoolEpochs: mMissingPoolRewardsPoolEpochs}, {merge: true});
            console.info(new Date().toISOString() + "|  (pool: %s, epoch: %s) Writing new slots to doc succeeded", poolIdBech32, epoch)
            return { failed: false }
        } catch (err) {
            console.error(new Date().toISOString() + "|  Writing to document failed. Document path: %s, Err: %s", refStatusManagingDoc.path, err);
            return {
                failed: true,
                reason: "Writing to document failed. Document path: ".concat(refStatusManagingDoc.path).concat(", Err: ").concat(err)
            };
        }
    }).catch((err) => {
        console.error(new Date().toISOString() + "|  Retrieving document failed. Document path: %s, Err: %s", refStatusManagingDoc.path, err);
        return {
            failed: true,
            reason: "Retrieving document failed. Document path: ".concat(refStatusManagingDoc.path).concat(", Err: ").concat(err)
        };
    });
};

const formatDate = function (date) {
    return date.toISOString().replace(/T/, "-").replaceAll(/:/g, "-").replaceAll(/\./g, "-").replaceAll(/[a-z,A-Z]/g, "").replaceAll(/-/g, "_");
};

const toBech32 = function (poolId) {
    const POOL_PREFIX = "pool";
    const wordsHex = bech32.toWords(Buffer.from(poolId, "hex"));
    return bech32.encode(POOL_PREFIX, wordsHex);
};

const getFileName = function (filePath) {
    const components = filePath.split("/");
    const lastIndex = components.length - 1;
    const file = components[lastIndex];
    return file.endsWith(".blocks.json") ? file.replaceAll(".blocks.json", "") : file;
};

const getPoolStakeAddress = function (poolIdBech32, ticker, epoch) {
    return apiUtil.retrievePoolData(poolIdBech32).then(function (response) {
        if (response.stderr) {
            sendFailedStakeAddressMail(ticker, epoch, response.stderr);
            return undefined;
            
        }
        const poolData = JSON.parse(response.stdout);
        if (poolData.error) {
            sendFailedStakeAddressMail(ticker, epoch, response.stderr);
            return undefined;
        }
        return poolData.reward_account;
    }).catch(function (err) {
        sendFailedStakeAddressMail(ticker, epoch, err);
        return undefined;
    });
};

const sendFailedStakeAddressMail = function (ticker, epoch, reason) {
    const failedFileName = ticker + ".blocks.json";
    const info = ["FileName: " + failedFileName, "Pool ticker: " + ticker, "Epoch: " + epoch, "Reason: " + reason];
    mailerUtil.sendMail(
            "FAILED json processing: ".concat(epoch).concat("/").concat(failedFileName),
            "<span>" + info + "</span>",
            "pool-JSON-loader",
            info);
};

const processFile = async function (filePath, failedDir, archiveDir, inboxDir, t) {
    const PLANNED_STATUS = "planned";
    console.info(new Date().toISOString() + "|  Processing file %s", filePath);
    let ticker = "";
    let poolStatus = {};
    let plannedSlotsList = [];
    try {
        ticker = getFileName(filePath);
        poolStatus.ticker = true;
        const data = fs.readFileSync(filePath, {encoding: "utf8"});
        const epochJson = JSON.parse(data);
        validateEpoch(epochJson);
        epochJson.poolIdBech32 = toBech32(epochJson.poolId);
        poolStatus.poolIdBech32 = true;
        
        epochJson.assignedSlots = epochJson.assignedSlots.map(function (slotJson) {
            // invalid slot dataset => move to failed
            if (!validSlot(slotJson)) throw new Error("Invalid dataset received for slot.");
            
            slotJson.epoch = epochJson.epoch;
            slotJson.status = PLANNED_STATUS;
            if (slotJson.slotInEpoch <= 1000) slotJson.comment = "[WARNING] Close to Epoch border"
            plannedSlotsList.push(slotJson.slot);
            return slotJson;
        })
        .sort((a, b) => a.no < b.no ? -1 : 1);
        epochJson.status = { assignedSlots: {} };
        
        return await pushEpochData(epochJson, ticker, poolStatus, plannedSlotsList, t);
    } catch (err) { // problems parsing json/reading file/invalid epoch/slot dataset => move to failed
        return {
            failed: true,
            reason: err.message?.concat(". \nStacktrace: ").concat(err.stack)
        }
    }
};

const processInbox = function () {
    const INBOX_DIR = "/inbox";
    const FAILED_DIR = "/failed";
    const ARCHIVE_DIR = "/archived";
    const rootDir = process.env.ROOT_DIR_POOL_JSON_LOADER;
    const inboxDir = path.join(rootDir, INBOX_DIR);
    const failedDir = path.join(rootDir, FAILED_DIR);
    const archiveDir = path.join(rootDir, ARCHIVE_DIR);
    const epochDirectories = getDirectories(inboxDir);
    epochDirectories.forEach(async (dir) => {
        const filesInDir = getFiles(dir);
        console.info(new Date().toISOString() + "|  Processing directory %s", dir);
        for (let i = 0; i < filesInDir.length; i++) {
            const jsonFile = filesInDir[i];
            try {
                console.info(new Date().toISOString() + "|  (file: %s) Initiating transaction for file", jsonFile)
                const result = await dbUtil.transaction(dbUtil.statusManagingDocRef(), 
                    async (t) => await processFile(jsonFile, failedDir, archiveDir, inboxDir, t));
                console.info(new Date().toISOString() + "|  (file: %s) Transaction finished. Result: %s", jsonFile, result)
                moveFile(jsonFile, getFileName(jsonFile), result.failed, result.reason, failedDir, archiveDir, inboxDir);
            } catch (err) {
                console.error(new Date().toISOString() + "|  Failure while processing json file. Document path: %s, Err: %s", jsonFile, err);
            }
        }
        fs.promises.readdir(dir).then((files) => {
            if (files.length === 0) fs.rmSync(path.toNamespacedPath(dir), {recursive: true}); // removes processed directory
        });
    });
};

if (! ('ROOT_DIR_POOL_JSON_LOADER' in process.env)) throw new Error("ROOT_DIR_POOL_JSON_LOADER must be set");

const schedule = process.env.JSON_LOADER_CRON ? process.env.JSON_LOADER_CRON : '*/10 * * * *';
console.info("Scheduling JSON loader at ", schedule);
cron.schedule(schedule, function () {
    console.info("Processing inbox. Timestamp: %s", new Date().toISOString());
    processInbox();
});
