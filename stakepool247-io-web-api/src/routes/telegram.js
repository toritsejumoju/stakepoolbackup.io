import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';

const router = Router()

const availableTypes = [
    {value: 'alert', label: 'Alerts'},
    {value: 'new_block', label: 'New Block'},
    {value: 'new_epoch', label: 'Epoch Summary'},
    {value: 'epoch_slots_uploaded', label: 'Slots Uploaded'}
]

router.get('/availableNotifications', requireAuth, (req, res) => {
    res.json(availableTypes)
})

router.get('/chats', requireAuth, (req, res) => {
    getFirestore('stakepool247-v2')
        .collection("telegramChats")
        .where("user", '==', req.uid)
        .get()
        .then((chatDocs) => {
            res.json(chatDocs.docs.map((chat) => ({ ...chat.data(), id: chat.id })));
        })
        .catch(error => {
            console.error(error)
            res.sendStatus(404).json()
        });
})

router.put('/chats', requireAuth, async (req, res) => {
    const id = req.body.id
    const types = req.body.notificationTypes

    if (typeof id !== 'string') {
        return res.status(400).json('ID field incorrect')
    }

    if (!types || types?.length == 0) {
        return res.status(400).json('notificationTypes field incorrect')
    }

    if (types?.some(t => typeof t !== 'string') || types?.some(t => availableTypes.find(at => at.value === t) === undefined)) {
        return res.status(400).json('notificationTypes field values incorrect')
    }

    getFirestore('stakepool247-v2')
        .collection("telegramChats")
        .doc(id)
        .get()
        .then((chatDoc) => {
            if (chatDoc.data().user !== req.uid) {
                return res.status(403).json({message: 'Chat not owned by user'})
            }
            getFirestore('stakepool247-v2')
                .collection('telegramChats')
                .doc(id)
                .update({notificationTypes: types})
                .then(() => {
                    res.json({...chatDoc.data(), id: chatDoc.id, notificationTypes: types})
                })
                .catch(e => {
                    console.error(error)
                    res.sendStatus(500).json({message: 'Error updating chat'})
                })
        })
        .catch(error => {
            console.error(error)
            res.sendStatus(404).json()
        });
})

router.delete('/chats/:id', requireAuth, async (req, res) => {
    const id = req.params.id

    if (typeof id !== 'string') {
        return res.status(400).json('ID field incorrect')
    }

    getFirestore('stakepool247-v2')
        .collection("telegramChats")
        .doc(id)
        .get()
        .then((chatDoc) => {
            if (chatDoc.data().user !== req.uid) {
                return res.status(403).json({message: 'Chat not owned by user'})
            }
            getFirestore('stakepool247-v2')
                .collection('telegramChats')
                .doc(id)
                .delete()
                .then(() => {
                    res.json({id: chatDoc.id})
                })
                .catch(e => {
                    console.error(error)
                    res.sendStatus(500).json({message: 'Error deleting chat'})
                })
        })
        .catch(error => {
            console.error(error)
            res.sendStatus(404).json()
        });
})

export default router