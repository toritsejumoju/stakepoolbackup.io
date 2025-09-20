const Queue = require('bull')

const botNotificationsQueue = new Queue(`${process.env.QUEUE_PREFIX}bot-notifications`)

const notifyNewBlock = (poolId, slot, epoch) => {
    botNotificationsQueue.add({
        receivers: {
            pools: [poolId]
        },
        type: 'new_block',
        data: {
            poolId: poolId,
            slot: slot.slot,
            block: slot.block,
            slotNo: slot.no,
            status: slot.status,
            comment: slot.comment,
            blockUrl: slot.blockUrl,
            tx_count: slot.tx_count,
            fees: slot.fees,
            failedReason: slot.failedReason,
            epoch: slot.epoch,
            epochData: epoch,
        }
      })
}

module.exports = {
    notifyNewBlock
}
