import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { getFirestore } from 'firebase-admin/firestore';
import { loadFirestoreUser } from '../utils/user.js';

const router = Router()

router.post('/',
    body('email').isEmail(),
    body('message').isString(),
    body('contactMe').isBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, message, contactMe } = req.body
        const timestamp = new Date();
        const docId = timestamp.getTime().toString().concat("_").concat(email);

        let authenticatedEmail = ''

        if (req.uid) {
            authenticatedEmail = await loadFirestoreUser(req.uid).then(user => user.email) || ''
        }

        getFirestore('stakepool247-v2')
            .collection("contactInquiries")
            .doc(docId).set({
                authenticatedEmail: authenticatedEmail,
                submittedEmail: email,
                message: message,
                shouldContact: contactMe,
                submitDate: timestamp.toISOString()
            })
            .then(() => { res.status(201).json() })
            .catch(() => {
                res.status(500).json()
            })
    })

export default router