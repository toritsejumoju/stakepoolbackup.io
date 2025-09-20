import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { getFirestore } from 'firebase-admin/firestore'
import { requireAuth, requireAdmin } from '../../middleware/auth.js'

const router = Router({ mergeParams: true })

router.get('/',
    requireAuth,
    async (req, res) => {
        getFirestore('stakepool247-v2')
            .collection('poolData').doc(req.params.poolId).collection('epochs')
            .get()
            .then((epochs) => {
                if (epochs.empty) {
                    return res.status(404).json()
                }
                res.json(epochs.docs.sort((a, b) => a.id > b.id ? -1 : 1).map(epoch => epoch.data()))
            })
            .catch((error) => {
                console.log(error)
                res.status(500).json()
            })
    })

router.post('/:epochId/comment/:slotId',
    requireAdmin,
    body('message').isString(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        getFirestore('stakepool247-v2')
            .doc(`/poolData/${req.params.poolId}/epochs/${req.params.epochId}`)
            .update({ [`modifications.slots.${req.params.slotId}.comment`]: req.body.message })
            .then(() => {
                return res.status(200).json()
            })
            .catch((error) => {
                console.log(error)
                res.status(500).json()
            })
    })

export default router