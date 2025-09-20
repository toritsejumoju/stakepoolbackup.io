import firebase from './utils/firebase.js'
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import Queue from "bull"

const botNotificationsQueue = new Queue(`${process.env.QUEUE_PREFIX}bot-notifications`)
// botNotificationsQueue.on

const sendNotif = async () => {
    console.log('sending')
    await botNotificationsQueue.add({
        receivers: {
            users: ["bPPuhxCrYTTmxEBZYLur5tWJBH83"]
        },
        type: 'alert',
        data: {
            message: "Tesing..."
        }
    })
    console.log('sent')
}

sendNotif()
