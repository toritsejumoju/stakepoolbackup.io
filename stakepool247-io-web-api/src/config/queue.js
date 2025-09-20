import Queue from "bull"

export const botNotificationsQueue = new Queue(`${process.env.QUEUE_PREFIX}bot-notifications`)

