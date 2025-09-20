import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';

const router = Router()

router.get('/', (req, res) => {
    getFirestore('stakepool247-v2')
        .collection("globalData")
        .doc("data")
        .get()
        .then((globalData) => {
            res.json(globalData.data())
        })
        .catch(error => {
            console.error(error)
            res.sendStatus(404).json()
        });
})

export default router