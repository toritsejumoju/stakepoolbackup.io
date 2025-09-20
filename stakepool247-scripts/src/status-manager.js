require("console-stamp")(console, "yyyy.mm.dd HH:MM:ss.l");

const dbUtil = require("./firebase.util.js");
const apiUtil = require("./data-api.util.js");
const mailerUtil = require("./mailer.util.js");
const cron = require("node-cron");
const { notifyNewBlock } = require("./queue.util.js");

const DO_MERGE_FLAG = { merge: true };

/**
 * Program uses env variables:
 *      OPTIONAL:
 *          STATUS_MANAGER_CRON (Cron expression for JSON loader schedule - defaults to "3,8,13,18,23,28,33,38,43,48,53,58 * * * *")
 */
async function processDocuments() {
    apiUtil.retrieveBlocksLatest().then(async (responseBlocksLatest) => {
        let latestEpoch;
        let latestSlot;
        if (!responseBlocksLatest.stderr) {
            const latest = JSON.parse(responseBlocksLatest.stdout);
            if (latest.error) {
                console.error("Failed to retrieve latest block data from API, error: %s", latest.error)
            } else {
                latestEpoch = latest.epoch;
                latestSlot = latest.slot;
                console.info("Retrieved latest epoch: %d; latest slot: %d", latestEpoch, latestSlot);
            }
        }
        if (latestEpoch && latestSlot) {
            const statusManagingRef = dbUtil.statusManagingDocRef();

            console.info("Retrieving status doc (status-manager)")
            statusManagingRef.get().then(async (statusManagingDoc) => {
                const dataStatusManaging = statusManagingDoc.data();

                const dataUpcomingSlots = dataStatusManaging.upcomingSlots;
                console.info("Status doc contents (upcoming slots: %s)", dataUpcomingSlots)
                const passedSlotDocPaths = new Set(Object.entries(dataUpcomingSlots).filter((entry) => Number(entry[0]) < latestSlot).map((entry) => entry[1]));

                const dataMissingRewards = dataStatusManaging.missingPoolRewardsPoolEpochs;
                const missingRewardsDocPaths = new Set(Object.entries(dataMissingRewards).filter((entry) => Number(entry[0].split("_EPOCH_")[1])  <= latestEpoch - 2).map((entry) => entry[1]));

                const docsToProcess = [...unionSet(passedSlotDocPaths, missingRewardsDocPaths)];
                const batch = dbUtil.db().batch();
                for (let i = 0; i < docsToProcess.length; i++) {
                    await dbUtil.db().doc(docsToProcess[i]).get().then(async function (snapDataEpochDoc) {
                        if (passedSlotDocPaths.has(docsToProcess[i])) {
                            console.info("Executing pending slots script for document %s", snapDataEpochDoc.ref.path);
                            await processPendingSlots(snapDataEpochDoc, latestSlot, batch, statusManagingRef);
                        }
                        if (missingRewardsDocPaths.has(docsToProcess[i])) {
                            console.info("Executing pool rewards script for document %s", snapDataEpochDoc.ref.path);
                            await processPoolRewards(snapDataEpochDoc, batch, statusManagingRef);
                        }
                    });
                    if (i === docsToProcess.length - 1) {
                        batch.commit().catch((err) => console.error("Committing status update transaction failed, error: %s", err));
                    }
                }
            }).catch((err) => console.error("Failed retrieving doc in transaction, %s", err));
        }
        updateGlobalDataLatestEpoch(latestEpoch);
    }).catch((err) => console.error("Failed to retrieve latest block data from API, error: %s", err));
}

function unionSet(s1, s2) {
    if (!s1 instanceof Set || !s2 instanceof Set) {
        console.error("The given objects are not of type Set");
        return new Set();
    }
    let union = new Set();
    s1.forEach((elem) => union.add(elem));
    s2.forEach((elem) => union.add(elem));
    return union;
}

function updateGlobalDataLatestEpoch(compareEpoch) {
    const refGlobalDataDoc = dbUtil.globalDatCollectionRef().doc("data");
    refGlobalDataDoc.get().then(function (snapGlobalDataDoc) {
        if (snapGlobalDataDoc.exists) {
            const data = snapGlobalDataDoc.data();
            if (data.latestEpoch) {
                if (compareEpoch === data.latestEpoch.epoch) {
                    // dont do anything
                    return;
                }
            }
        }
        apiUtil.retrieveEpochsLatest().then(function (responseEpochsLatest) {
            if (responseEpochsLatest.stderr) {
                console.error("Failed to retrieve latest epoch data from API, error: %s", responseEpochsLatest.stderr);
                return;
            }
            const jsonData = JSON.parse(responseEpochsLatest.stdout);
            if (jsonData.error) {
                console.error("Failed to retrieve latest epoch data from API, error: %s", jsonData.error);
                return;
            }
            refGlobalDataDoc.set(updateField({}, "latestEpoch", jsonData), DO_MERGE_FLAG)
                .catch((err) => console.error("Writing to document failed. Document path: %s. Err: %s", refGlobalDataDoc.path, err));
        }).catch((err) => console.error("Failed to retrieve latest epoch data from API, error: %s", err));
    });
}

const buildBlockUrl = function (block) {
    const CARDANOSCAN_URL = "https://cardanoscan.io/block/"; // later can be replaced by configurable env variables
    return CARDANOSCAN_URL.concat(block);
};

function updateField(objct, field, value) {
    objct[field] = value;
    return objct;
}

function onFailedStatusCheckForSlot(slot, poolIdBech32, epoch, statusSlot) {
    const currentFailedCount = statusSlot?.failedCount;

    if (!currentFailedCount || currentFailedCount === 0) { // if first time FAILED
        statusSlot = updateField(statusSlot, "failedCount", 1);
    } else if (currentFailedCount >= 1) { // if already FAILED before
        delete statusSlot.failedCount;
        slot.status = STATUS_FAILED;
        slot.comment = slot.slotInEpoch <= 1000 ? "Too close to epoch border" : "Orphaned block";
        slot.failedReason =  slot.slotInEpoch <= 1000 ? FAILED_REASON_NEAR_BORDER : FAILED_REASON_OTHER;
        slot.blockUrl = N_A;
        slot.tx_count = N_A;
        slot.fees = N_A;
    }

    const placeholder = updateField({}, "slot", slot);
    placeholder.statusSlot = statusSlot;
    return placeholder;
}

function onSlotBattleGenerateComment(slot, slotLeader, statusSlot) {
    const placeholder = updateField({}, "statusSlot", statusSlot);
    return apiUtil.retrievePoolMetadata(slotLeader).then(function (response) {
        // Failed to retrieve data for slot leader (pool) :
        if (response.stderr) {
            placeholder.slot = updateField(slot, "comment", "Slot battle");
            return placeholder;
        }
        const metadata = JSON.parse(response.stdout);
        if (metadata.error) {
            placeholder.slot = updateField(slot, "comment", "Slot battle");
            return placeholder;
        }

        // Successfully retrieved data for slot leader (pool) :
        placeholder.slot = metadata.ticker
                ? updateField(slot, "comment", "Slot battle (lost to ".concat(metadata.ticker.toUpperCase()).concat(")"))
                : updateField(slot, "comment", "Slot battle (lost to private pool)");
        return placeholder;
    }).catch(function (err) {
        console.error("Failed to retrieve data from API for poolMetadata.ticker (poolIdBech: %s), error: %s", slotLeader, err);
        return updateField(placeholder, "slot", slot);
    });
}

const N_A = "N/A";
const STATUS_MINTED = "minted";
const STATUS_PLANNED = "planned";
const STATUS_FAILED = "failed";
const FAILED_REASON_SLOT_BATTLE = "SLOT_BATTLE";
const FAILED_REASON_NEAR_BORDER = "NEAR_BORDER";
const FAILED_REASON_OTHER = "OTHER";
const updateCurrentSlotStatus = function (slot, poolIdBech32, epoch, statusSlot) {
    statusSlot = statusSlot ? statusSlot : {};
    return apiUtil.retrieveBlocksSlot(slot.slot).then(function (response) {
        // Failed to retrieve data for slot :
        if (response.stderr) {
            slot.notifyByMail = true;
            return onFailedStatusCheckForSlot(slot, poolIdBech32, epoch, statusSlot);
        }
        const slotData = JSON.parse(response.stdout);
        if (slotData.error) {
            slot.notifyByMail = true;
            return onFailedStatusCheckForSlot(slot, poolIdBech32, epoch, statusSlot);
        }
        const slotLeader = slotData.slot_leader;
        if (slotData === {} || slotLeader === "") {
            slot.notifyByMail = true;
            return onFailedStatusCheckForSlot(slot, poolIdBech32, epoch, statusSlot);
        }

        // Successfully retrieved data for slot :
        delete statusSlot.failedCount;
        const height = slotData.height;
        if (poolIdBech32 !== slotLeader) {
            // Slot Battle :
            slot.status = STATUS_FAILED;
            slot.blockUrl = buildBlockUrl(height);
            slot.block = height;
            slot.tx_count = Number(slotData.tx_count);
            slot.fees = Number(slotData.fees);
            slot.failedReason = FAILED_REASON_SLOT_BATTLE;
            return onSlotBattleGenerateComment(slot, slotLeader, statusSlot);
        }
        if (poolIdBech32 === slotLeader) {
            slot.status = STATUS_MINTED;
            slot.comment = N_A;
            slot.blockUrl = buildBlockUrl(height);
            slot.block = height;
            slot.tx_count = Number(slotData.tx_count);
            slot.fees = Number(slotData.fees);
        }
        const placeholder = updateField({}, "statusSlot", statusSlot);
        return updateField(placeholder, "slot", slot);
    }).catch(function (err) {
        console.error("Failed to retrieve data from API for slot %s (poolIdBech: %s), error: %s", slot.slot, poolIdBech32, err);
        slot.notifyByMail = true;
        return onFailedStatusCheckForSlot(slot, poolIdBech32, epoch, statusSlot);
    });
};

const processPoolRewards = async function (snapDataEpochDoc, t, statusManagingRef) {
    const dataEpochDoc = snapDataEpochDoc.data();
    const poolIdBech32 = dataEpochDoc.poolIdBech32;
    const epoch = dataEpochDoc.epoch;
    const assignedSlots = dataEpochDoc.assignedSlots;
    const rewardsStatusKey = poolIdBech32.concat("_EPOCH_").concat(epoch);

    if (assignedSlots === undefined || assignedSlots.length === 0
            || assignedSlots.filter((slot) => slot.status === "failed")?.length === assignedSlots.length) {
        // If no slots in epoch for pool or all have failed, then pool rewards = 0
        await t.set(snapDataEpochDoc.ref, { poolRewards: 0 }, DO_MERGE_FLAG);
        const mMissingPoolRewardsPoolEpochs = {};
        mMissingPoolRewardsPoolEpochs[rewardsStatusKey] = dbUtil.deleteValue();
        await t.set(statusManagingRef, { missingPoolRewardsPoolEpochs: mMissingPoolRewardsPoolEpochs }, DO_MERGE_FLAG);
    } else {
        const refParentPoolDoc = dbUtil.poolsDataCollectionRef().doc(poolIdBech32);
        await refParentPoolDoc.get().then(async (snapDataPoolDoc) => {
            const stakeAddress = snapDataPoolDoc.get("poolStakeAddress");
            await apiUtil.retrievePoolRewards(stakeAddress).then(async (response) => {
                // Failed to retrieve pool rewards
                if (response.stderr) {
                    console.error("Failed to retrieve poolRewards data from API for poolStakeAddress %s (poolIdBech: %s), error: %s", stakeAddress, poolIdBech32, response.stderr);
                    return;
                }
                const rewards = JSON.parse(response.stdout);
                if (rewards.error) {
                    console.error("Failed to retrieve poolRewards data from API for poolStakeAddress %s (poolIdBech: %s), error: %s", stakeAddress, poolIdBech32, rewards.error);
                    return;
                }

                // Successfully retrieved pool rewards
                const poolRewards = rewards.filter(r => r.epoch === epoch).map(e => Number(e.amount));
                if (poolRewards.length > 0) {
                    await t.set(snapDataEpochDoc.ref, { poolRewards: poolRewards.reduce((a, b) => a + b, 0)}, DO_MERGE_FLAG);
                    const mMissingPoolRewardsPoolEpochs = {};
                    mMissingPoolRewardsPoolEpochs[rewardsStatusKey] = dbUtil.deleteValue();
                    await t.set(statusManagingRef, { missingPoolRewardsPoolEpochs: mMissingPoolRewardsPoolEpochs }, DO_MERGE_FLAG);
                }
            }).catch((err) => console.error("Failed to retrieve poolRewards data from API for poolStakeAddress %s (poolIdBech: %s), error: %s", stakeAddress, poolIdBech32, err));
        }).catch((err) => console.error("Failed to retrieve pool doc from DB for poolIdBech: %s, document path: %s, error: %s", poolIdBech32, refParentPoolDoc.path,  err));
    }
};

const processPendingSlots = async function (snapDataEpochDoc, latestSlot, t, statusManagingRef) {
    const dataEpochDoc = snapDataEpochDoc.data();
    const slotsData = dataEpochDoc.assignedSlots;
    const poolIdBech32 = dataEpochDoc.poolIdBech32;
    const epoch = dataEpochDoc.epoch;
    const slotsCount = slotsData.length;
    let status = dataEpochDoc.status;
    let statusSlots = status.assignedSlots ? status.assignedSlots : {};

    const processedSlots = [];
    const uUpcomingSlots = {};
    let containsUpdate = false;

    for (let i = 0; i < slotsCount; i++) {
        let slot = slotsData[i];
        // if status is planned, and the slot should have already been processed by blockchain, then:
        if (slot.status === STATUS_PLANNED && slot.slot < latestSlot) {
            const isLastSlot = await updateCurrentSlotStatus(slot, poolIdBech32, epoch, statusSlots[slot.slot]).then(async function (response) {
                containsUpdate = true;
                const updatedSlot = response.slot;
                statusSlots[slot.slot] = response.statusSlot;

                if (updatedSlot.status !== STATUS_PLANNED) {
                    uUpcomingSlots[updatedSlot.slot] = dbUtil.deleteValue();
                    notifyNewBlock(poolIdBech32, slot, dataEpochDoc);

                    if (updatedSlot.status === STATUS_FAILED && updatedSlot.notifyByMail) {
                        sendFailedSlotEmail(updatedSlot, poolIdBech32, epoch);
                    }
                }
                delete updatedSlot.notifyByMail;
                processedSlots.push(updatedSlot);
                if (processedSlots.length === slotsCount) {
                    statusSlots = removeEmptyStatuses(statusSlots);
                    status = updateField(status, "assignedSlots", statusSlots);
                    await t.update(snapDataEpochDoc.ref, { assignedSlots: processedSlots.sort((a, b) => a.no < b.no ? -1 : 1), status: status })
                    if (Object.keys(uUpcomingSlots).length > 0) await t.set(statusManagingRef, { upcomingSlots: uUpcomingSlots }, DO_MERGE_FLAG);
                    return true; // must return true as a notification, that the last spot has been processed
                }
            });
            if (isLastSlot) return; // must return when the last slot has been processed
        } else {
            processedSlots.push(slot);
            if (processedSlots.length === slotsCount) {
                if (containsUpdate) {
                    statusSlots = removeEmptyStatuses(statusSlots);
                    status = updateField(status, "assignedSlots", statusSlots);
                    await t.update(snapDataEpochDoc.ref, { assignedSlots: processedSlots.sort((a, b) => a.no < b.no ? -1 : 1), status: status })
                    if (Object.keys(uUpcomingSlots).length > 0) await t.set(statusManagingRef, { upcomingSlots: uUpcomingSlots }, DO_MERGE_FLAG);
                }
                return; // must return when the last slot has been processed
            }
        }
    }
};

function removeEmptyStatuses(statusSlots) {
    const slots = Object.keys(statusSlots);
    slots.forEach((slot) => {
        if (Object.keys(statusSlots[slot]).length === 0) delete statusSlots[slot];
    })
    return statusSlots;
}

function sendFailedSlotEmail(slot, poolIdBech32, epoch) {
    dbUtil.poolsDataCollectionRef().doc(poolIdBech32).get()
    .then(function (snapDataPoolDoc) {
        const ticker = snapDataPoolDoc.get("ticker");
        const info = ["PoolId: " + poolIdBech32,
            "Pool ticker: " + ticker,
            "Epoch: " + epoch,
            "Slot: " + slot.slot,
            "Slot block url (if applicable): " + slot.blockUrl];
        mailerUtil.sendMail(
                "Slot status changed to FAILED. Slot: ".concat(slot.slot),
                "<span>" + info + "</span>",
                "status-manager",
                info);
    });
}

const schedule = process.env.STATUS_MANAGER_CRON ? process.env.STATUS_MANAGER_CRON : "15,45 * * * * *";
console.info("Scheduling status manager at ", schedule);
cron.schedule(schedule, function () {
    console.info("Checking document status");
    processDocuments();
});
