import { Router } from 'express'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { bfAPI } from '../config/blockfrost.js'
import { requireJWTAuth } from '../middleware/auth.js'
import { epochFromSlot, epochFromTime, slotInEpochFromSlot, SLOTS_IN_EPOCH } from '../utils/epoch.js'
import { validateConvertPoolIdToBech32 } from '../utils/pool.js'

const router = Router()

router.get('/latest', requireJWTAuth, async (req, res) => {
    const poolId = req.pool
    const epochsCollectionRef = getFirestore('stakepool247-v2').collection('poolData').doc(`${poolId}`).collection('epochs')
    const epochs = await epochsCollectionRef.orderBy('epoch', 'desc').limit(1).get()
    if (epochs.docs.length === 0) {
        return res.status(404).json(0)
    }
    return res.json(epochs.docs[0].data()?.epoch)
})

router.get('/accepting', requireJWTAuth, async (req, res) => {
    const currentEpoch = epochFromTime(Date.now())
    // Epoch after 1.5 days (36h)
    const nextEpoch = epochFromTime(Date.now() + 36 * 60 * 60 * 1000)
    if (currentEpoch !== nextEpoch) {
        return res.json(nextEpoch)
    }
    return res.json(currentEpoch)
})

router.post('/', requireJWTAuth, async (req, res) => {
    const poolId = req.pool
    const slotList = req.body || []
    if (!Array.isArray(slotList) || slotList.length === 0) {
        return res.status(400).json({ message: 'No slot data received' })
    }

    const minSlot = Math.min(...slotList.map((slot) => slot.slotNumber))
    const maxSlot = Math.max(...slotList.map((slot) => slot.slotNumber))

    const minSlotEpoch = epochFromSlot(minSlot)
    const maxSlotEpoch = epochFromSlot(maxSlot)
    const currentEpoch = epochFromTime(Date.now())

    if (minSlotEpoch !== maxSlotEpoch || minSlotEpoch !== currentEpoch + 1) {
        return res.status(400).json({ message: 'Data should be for only the next epoch' })
    }
    const epoch = minSlotEpoch

    const epochDocRef = getFirestore('stakepool247-v2').collection('poolData').doc(`${poolId}`).collection('epochs').doc(`${epoch}`)

    const slotsData = slotList
        .map((slot, index) => {
            const slotData = {
                no: index,
                slot: slot.slotNumber,
                slotInEpoch: slotInEpochFromSlot(slot.slotNumber),
                at: slot.slotTime,
                epoch: epoch,
                status: 'planned',
            }
            if (slotInEpochFromSlot(slot.slotNumber) <= 1000) {
                slotData.comment = '[WARNING] Close to Epoch border'
            }
            return slotData
        })
        .sort((a, b) => a.no - b.no)

    const bfPoolInfo = await bfAPI.poolsById(poolId)
    // const bfPoolHistory = await bfAPI.poolsByIdHistory(poolId, { count: 10, order: 'desc' });
    // const bfEpochData = bfPoolHistory.find(e => e.epoch === epoch)

    // if (!bfEpochData) {
    //     return res.status(400).json({message: 'Data should be for only one epoch'})
    // }

    const epochData = {
        epoch: epoch,
        epochSlots: slotList.length,
        epochSlotsIdeal: bfPoolInfo.active_size * SLOTS_IN_EPOCH,
        maxPerformance: (slotList.length / (bfPoolInfo.active_size * SLOTS_IN_EPOCH)) * 100,
        poolId: poolId,
        poolIdBech32: validateConvertPoolIdToBech32(poolId),
        activeStake: bfPoolInfo.active_stake,
        totalActiveStake: bfPoolInfo.active_stake / bfPoolInfo.active_size,
        assignedSlots: slotsData,
        status: {
            assignedSlots: {},
        },
    }

    await epochDocRef.set(epochData, { merge: true })

    const statusManagingDocRef = getFirestore('stakepool247-v2').collection('statusManaging').doc('statusManaging')
    const epochDocReff = `poolData/${poolId}/epochs/${epoch}`

    await getFirestore('stakepool247-v2').runTransaction(async (t) => {
        const statusDoc = await t.get(statusManagingDocRef)
        const data = statusDoc.data()
        const upcomingSlots = data.upcomingSlots
        Object.keys(upcomingSlots).forEach(slot => {
            if (upcomingSlots[slot] === epochDocReff) {
                upcomingSlots[slot] = FieldValue.delete()
            }
        })
        slotsData.forEach(slot => {
            upcomingSlots[slot.slot] = epochDocReff
        })

        const rewardsStatusKey = `${poolId}_EPOCH_${epoch}`
        const mMissingPoolRewardsPoolEpochs = data.missingPoolRewardsPoolEpochs;
        mMissingPoolRewardsPoolEpochs[rewardsStatusKey] = epochDocReff;
        return await t.set(statusManagingDocRef, {upcomingSlots: upcomingSlots, missingPoolRewardsPoolEpochs: mMissingPoolRewardsPoolEpochs}, {merge: true});
    })

    return res.status(201).json({ message: 'Received data processed' })
})

export default router

// [
//     {
//         "slotNumber": 71066008,
//         "slotTime": "2022-09-08T10:18:19Z"
//     },
//     {
//         "slotNumber": 71078007,
//         "slotTime": "2022-09-08T13:38:18Z"
//     },
//     {
//         "slotNumber": 71129368,
//         "slotTime": "2022-09-09T03:54:19Z"
//     },
//     {
//         "slotNumber": 71157432,
//         "slotTime": "2022-09-09T11:42:03Z"
//     },
//     {
//         "slotNumber": 71165103,
//         "slotTime": "2022-09-09T13:49:54Z"
//     },
//     {
//         "slotNumber": 71198550,
//         "slotTime": "2022-09-09T23:07:21Z"
//     },
//     {
//         "slotNumber": 71213285,
//         "slotTime": "2022-09-10T03:12:56Z"
//     },
//     {
//         "slotNumber": 71216618,
//         "slotTime": "2022-09-10T04:08:29Z"
//     },
//     {
//         "slotNumber": 71254871,
//         "slotTime": "2022-09-10T14:46:02Z"
//     },
//     {
//         "slotNumber": 71284710,
//         "slotTime": "2022-09-10T23:03:21Z"
//     },
//     {
//         "slotNumber": 71291081,
//         "slotTime": "2022-09-11T00:49:32Z"
//     },
//     {
//         "slotNumber": 71304378,
//         "slotTime": "2022-09-11T04:31:09Z"
//     },
//     {
//         "slotNumber": 71306241,
//         "slotTime": "2022-09-11T05:02:12Z"
//     },
//     {
//         "slotNumber": 71348318,
//         "slotTime": "2022-09-11T16:43:29Z"
//     },
//     {
//         "slotNumber": 71361716,
//         "slotTime": "2022-09-11T20:26:47Z"
//     },
//     {
//         "slotNumber": 71369535,
//         "slotTime": "2022-09-11T22:37:06Z"
//     },
//     {
//         "slotNumber": 71382809,
//         "slotTime": "2022-09-12T02:18:20Z"
//     },
//     {
//         "slotNumber": 71413640,
//         "slotTime": "2022-09-12T10:52:11Z"
//     },
//     {
//         "slotNumber": 71429879,
//         "slotTime": "2022-09-12T15:22:50Z"
//     }
// ]
