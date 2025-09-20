import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore'
import epochRoute from './epoch.js'
import registrationRoute from './registration.js'
import { requireAdmin, requireAuth } from '../../middleware/auth.js'
import { loadAccessiblePools, loadAllPools, loadOwnedPools, loadReadAccessPools } from '../../utils/pool.js'
import { loadPoolEpochs } from '../../utils/epoch.js'
import { emailRegex } from '../../utils/user.js'
import { updateClaimsPoolCount } from '../../utils/user.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
    let pools = []
    if (req.isAdmin && req.query.all) {
        pools = await loadAllPools()
    } else if (req.query.sharedOnly) {
        pools = await loadReadAccessPools(req.uid)
    } else if (req.query.ownedOnly) {
        pools = await loadOwnedPools(req.uid)
    } else {
        pools = await loadAccessiblePools(req.uid)
    }

    await updateClaimsPoolCount(req.uid, pools.length)

    if (req.query.withEpochs) {
        const epochRequests = []
        pools.forEach(pool => {
            const epochRequest = loadPoolEpochs(pool.poolIdBech32).then(epoch => {
                pools.find(p => p.poolIdBech32 === pool.poolIdBech32).epochs = epoch
            })
            epochRequests.push(epochRequest)
        })
        await Promise.all(epochRequests)
        return res.json(pools)
    } else {
        return res.json(pools)
    }
})

router.get('/accessInfo', requireAuth, async (req, res) => {
    let poolsFilter = getFirestore('stakepool247-v2').collection('poolData')
    if (!req.isAdmin) {
        console.log('adding filter', req.uid)
        poolsFilter = poolsFilter.where('owner', '==', req.uid)
    }
    const pools = await poolsFilter.get()
    console.log(pools.docs.map(p => p.data()))
    const userIds = new Set()
    pools.docs.forEach(pool => {
        userIds.add(pool.data().owner)
        pool.data().allowRead?.forEach(readUser => userIds.add(readUser))
    })

    const allUsers = [...userIds].filter(u => u !== '')
    let userDocs = []
    if (allUsers.length > 0) {
        let usersFilter = getFirestore('stakepool247-v2').collection('users')
        if (!req.isAdmin) {
            usersFilter = usersFilter.where(FieldPath.documentId(), 'in', allUsers)
        }
        const users = await usersFilter.get()
        users.docs.forEach(u => userDocs.push(u))
    }

    res.json({ pools: pools.docs.map(p => ({ ...p.data(), id: p.id })), users: userDocs.map(u => ({ ...u.data(), id: u.id })) })
})

router.put('/accessInfo/:poolId', requireAuth, async (req, res) => {
    const poolId = req.params.poolId
    let newOwner = req.body.owner
    const newReadAccess = req.body.readAccess || []

    if (typeof poolId !== 'string') {
        return res.status(400).json('ID field incorrect')
    }
    if (newOwner && (typeof newOwner !== 'string' || !emailRegex.test(newOwner))) {
        return res.status(400).json('Owner field incorrect')
    }

    if (newReadAccess && newReadAccess?.length === undefined) {
        return res.status(400).json('ReadAccess field incorrect')
    }
    if (newReadAccess?.some(t => (typeof t !== 'string' || !emailRegex.test(t)))) {
        return res.status(400).json('ReadAccess field values incorrect')
    }

    const poolDoc = await getFirestore('stakepool247-v2').collection('poolData').doc(poolId).get()
    if (!req.isAdmin) {
        if (poolDoc.data().owner !== req.uid) {
            return res.status(403).json('Pool not owned by current user')
        }
    }

    // For now don't allow changin owner without admin rights through this interface
    if (!req.isAdmin) {
        newOwner = null
    }

    const userEmails = new Set()
    newReadAccess.forEach(email => userEmails.add(email))
    if (newOwner) {
        userEmails.add(newOwner)
    }

    const uDocs = []
    if (userEmails.size > 0) {
        const userDocs = await getFirestore('stakepool247-v2').collection('users').where('email', 'in', [...userEmails]).get()
        userDocs.docs.forEach(u => uDocs.push(u))
    }

    const newUserEmails = new Set()
    const existingUserEmails = []

    uDocs.forEach(u => {
        if (newReadAccess.includes(u.data().email)) {
            existingUserEmails.push(u.data().email)
        }
    })
    newReadAccess.forEach(u => {
        if (!existingUserEmails.includes(u)) {
            newUserEmails.add(u)
        }
    })
    console.warn('Currently unhandled!!!', 'New user emails:', newUserEmails)

    const readAccessUserIds = newReadAccess.map(e => uDocs.find(u => u.data().email === e)?.id).filter(u => u)
    const newOwnerId = uDocs.find(u => u.data().email === newOwner)?.id || FieldValue.delete()

    const data = {
        allowRead: readAccessUserIds
    }

    if (newOwner) {
        data['owner'] = newOwnerId
    }
    console.log(data)

    await getFirestore('stakepool247-v2').collection('poolData').doc(poolId).update(data)

    const updatedDoc = await getFirestore('stakepool247-v2').collection('poolData').doc(poolId).get()
    res.json({...updatedDoc.data(), id: updatedDoc.id})
})

router.get('/:poolId',
    requireAuth,
    (req, res) => {
        getFirestore('stakepool247-v2')
            .collection('poolData')
            .doc(req.params.poolId)
            .get()
            .then((pool) => {
                if (!pool.exists) {
                    return res.status(404).json()
                }
                const data = { ...pool.data(), id: pool.id }
                if (req.isAdmin) {
                    return res.json(data)
                } else if (req.uid === data.owner || data.allowRead.indexOf(req.uid) !== -1) {
                    return res.json(data)
                }
                return res.status(403).json()
            })
            .catch((error) => {
                console.error(error)
                res.status(500).json()
            })
    })

router.put('/:poolId/owner',
    requireAdmin,
    body('user').isString(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        getFirestore('stakepool247-v2')
            .collection('poolData')
            .doc(req.params.poolId)
            .update({ owner: req.body.user })
            .then(() => {
                res.status(200).json()
            })
            .catch((error) => {
                console.error(error)
                res.status(500).json()
            })
    })

router.put('/:poolId/read-access',
    requireAdmin,
    body('user').isString(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        getFirestore('stakepool247-v2')
            .collection('poolData')
            .doc(req.params.poolId)
            .update({ allowRead: FieldValue.arrayUnion(req.body.user) })
            .then(() => {
                res.status(200).json()
            })
            .catch((error) => {
                console.error(error)
                res.status(500).json()
            })
    })

router.delete('/:poolId/read-access',
    requireAdmin,
    body('user').isString(),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        getFirestore('stakepool247-v2')
            .collection('poolData')
            .doc(req.params.poolId)
            .update({ allowRead: FieldValue.arrayRemove(req.body.user) })
            .then(() => {
                res.status(200).json()
            })
            .catch((error) => {
                console.error(error)
                res.status(500).json()
            })
    })

router.use('/:poolId/epochs', epochRoute);
router.use('/registration', registrationRoute);

export default router