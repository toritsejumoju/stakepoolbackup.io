import { getFirestore } from 'firebase-admin/firestore'

export const loadPoolEpochs = async (poolId) => {
    return await getFirestore('stakepool247-v2')
        .collection('poolData')
        .doc(poolId)
        .collection('epochs')
        .get()
        .then((epochs) => {
            return epochs.docs.map((epoch) => ({ ...epoch.data(), id: epoch.id }))
        })
}

export const SLOTS_IN_EPOCH = 432000
const EPOCH_OFFSET = 198
const SLOTS_OFFSET = 172800
const TIME_OFFSET = 1591739091

export const epochFromSlot = (slot) => {
    return Math.floor((slot - SLOTS_OFFSET) / SLOTS_IN_EPOCH) + EPOCH_OFFSET
}

export const slotInEpochFromSlot = (slot) => {
    return (slot - SLOTS_OFFSET) % SLOTS_IN_EPOCH
}

export const epochFromTime = (time) => {
    return Math.floor((Math.floor(time / 1000) - TIME_OFFSET) / SLOTS_IN_EPOCH) + EPOCH_OFFSET
}

export const slotInEpochFromTime = (time) => {
    return (Math.floor(time / 1000) - TIME_OFFSET) % SLOTS_IN_EPOCH
}
