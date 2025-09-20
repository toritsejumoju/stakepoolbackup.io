#!/bin/bash
###############################################################################
### ADJUST CONFIGURATION FOR YOUR ENVIRONMENT                               ###
###############################################################################

SHELLEY_GENESIS_FILE_PATH="/home/cardano/config/mainnet-shelley-genesis.json"
POOL_ID_FILE="/home/cardano/cnode/keys/pool.id"
VRF_SIGNING_KEY_FILE_PATH="/home/cardano/cnode/keys/pool.vrf.skey"
CARDANO_CLI="/home/cardano/.local/bin/cardano-cli"
SOCKET="/home/cardano/cnode/sockets/node.socket"

# get your BP nodes Device Token at app.stakepool247.io
STAKEPOOL247_API_DEVICE_TOKEN=""


###############################################################################
### DO NOT EDIT BELOW THIS LINE                                             ###
###############################################################################


STAKEPOOL247_API_ENDPOINT="https://testnet-api.stakepool247.io:4000/"
SCRIPT_PATH=$(dirname "$0" 2> /dev/null)

if [[ -f "${SCRIPT_PATH}/leadership.conf" ]]; then source "${SCRIPT_PATH}/leadership.conf"; fi
if [[ -f "$HOME/leadership.conf" ]]; then source "$HOME/leadership.conf"; fi

export CARDANO_NODE_SOCKET_PATH=${SOCKET}
POOL_ID=$(cat $POOL_ID_FILE )
TEMP_OUT_FILE_PATH="/tmp/${POOL_ID}.json"

generate_blocks () {
    echo "Generating blocks for next epoch ${NEXT_ACCEPTED_EPOCH}"
    $CARDANO_CLI query leadership-schedule --mainnet --genesis "$SHELLEY_GENESIS_FILE_PATH" --stake-pool-id "$POOL_ID" --vrf-signing-key-file "$VRF_SIGNING_KEY_FILE_PATH" --next --out-file "$TEMP_OUT_FILE_PATH"
    echo "Sending blocks to StakePool247 API"
    BLOCK_UPLOAD_STATUS=$(curl -Ss -w '%{http_code}' -X POST "${STAKEPOOL247_API_ENDPOINT}blocks" -H "Authorization: Bearer ${STAKEPOOL247_API_DEVICE_TOKEN}"  -H 'Content-Type: application/json' -d @"${TEMP_OUT_FILE_PATH}")
    if [ "201" != "$(echo ${BLOCK_UPLOAD_STATUS} | tail -1)" ]; then
        echo "Error uploading new blocks to API. Ending..."
        exit 1
    fi
}

fetch_epochs () {
    LAST_SUBMITTED_EPOCH=$(curl -Ss -w "\n%{http_code}" -X GET "${STAKEPOOL247_API_ENDPOINT}blocks/latest" -H "Authorization: Bearer ${STAKEPOOL247_API_DEVICE_TOKEN}" -H 'Content-Type: application/json')
    NEXT_ACCEPTED_EPOCH=$(curl -Ss -w "\n%{http_code}" -X GET "${STAKEPOOL247_API_ENDPOINT}blocks/accepting" -H "Authorization: Bearer ${STAKEPOOL247_API_DEVICE_TOKEN}" -H 'Content-Type: application/json')
    if [ "200" != "$(echo -e "${LAST_SUBMITTED_EPOCH}" | tail -1)" ] || [ "200" != "$(echo -e "${NEXT_ACCEPTED_EPOCH}" | tail -1)" ]; then
        echo "Error getting epoch data from server. Ending..."
        exit 1
    fi

    LAST_SUBMITTED_EPOCH=$(echo -e "${LAST_SUBMITTED_EPOCH}" | head -1)
    NEXT_ACCEPTED_EPOCH=$(echo -e "${NEXT_ACCEPTED_EPOCH}" | head -1)

    echo -e "Last submitted epoch ${LAST_SUBMITTED_EPOCH}, accepting blocks for epoch ${NEXT_ACCEPTED_EPOCH}"
}


fetch_epochs
if [ "$LAST_SUBMITTED_EPOCH" = "$NEXT_ACCEPTED_EPOCH" ]; then
    echo "No update needed. Ending..."
    exit 0
else
    generate_blocks
fi
