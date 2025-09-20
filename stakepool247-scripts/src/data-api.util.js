const {BlockFrostAPI} = require("@blockfrost/blockfrost-js");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

/**
 * Program uses env variables:
 *      REQUIRED:
 *          DATA_API_KEY (BlockFrost API key = = project_id. MUST be defined in order to authenticate against Blockfrost servers (note that each network (mainnet/testnet) has its own project_id))
 */

const API = new BlockFrostAPI({
    projectId: process.env.DATA_API_KEY
});

const retrieveBlocksSlot = function (slotId) {
    let path = "/blocks/slot/".concat(slotId);
    return apiCall(path, 0);
};

const retrieveBlocksLatest = function () {
    let path = "/blocks/latest";
    return apiCall(path, 0);
};

const retrieveEpochsLatest = function () {
    let path = "/epochs/latest";
    return apiCall(path, 0);
};

const retrievePoolMetadata = function (poolId) {
    let path = "/pools/".concat(poolId).concat("/metadata/");
    return apiCall(path, 0);
};

const retrievePoolRewards = function (stakeAddress) {
    let path = "/accounts/".concat(stakeAddress).concat("/rewards?order=desc");
    return apiCall(path, 0);
};

const retrievePoolData = function (poolId) {
    let path = "/pools/".concat(poolId);
    return apiCall(path, 0);
};

const apiCall = async function (path, repeatTimes) {
    try {
        let requestPath = API.apiUrl.concat(path);
        let apiKey = API.projectId;
        console.info("Executing API call: %s", requestPath);
        const response = await exec(`curl -sH "project_id: ${apiKey}" "${requestPath}"`);
        if (response.stderr) throw new Error(response.stderr);
        const jsonResponse = JSON.parse(response.stdout);
        if (jsonResponse.error) throw new Error(jsonResponse.error);
        return response;
    } catch (err) {
        if (repeatTimes < 2) {
            repeatTimes += 1;
            return apiCall(path, repeatTimes);
        }
        throw err;
    }
};

module.exports = {
    retrieveBlocksSlot: function (slotId) {
        return retrieveBlocksSlot(slotId);
    },
    retrievePoolData: function (poolId) {
        return retrievePoolData(poolId);
    },
    retrievePoolRewards: function (stakeAddress) {
        return retrievePoolRewards(stakeAddress);
    },
    retrievePoolMetadata: function (poolId) {
        return retrievePoolMetadata(poolId);
    },
    retrieveBlocksLatest: function () {
        return retrieveBlocksLatest();
    },
    retrieveEpochsLatest: function () {
        return retrieveEpochsLatest();
    }
};

if (! ('DATA_API_KEY' in process.env)) throw new Error("DATA_API_KEY must be set");
