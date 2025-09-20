import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore';
import * as jose from 'jose'
import { JWT_KEY } from '../config/jwt.js';
import { requireAuth, requireJWTAuth, requireValidJWTTRefreshToken } from '../middleware/auth.js';

const router = Router()

router.get('/', requireValidJWTTRefreshToken, (req, res) => {
    getFirestore('stakepool247-v2')
        .collection('poolData')
        .doc(req.pool)
        .get()
        .then(async (pool) => {
            if (!pool.exists) {
                return res.status(500).json({message: 'Associated pool not found'});
            }

            const poolData = pool.data()
            if (!poolData.devices?.find(dev => dev.name === req.device)) {
                return res.status(500).json({message: 'Associated device not found for pool'});
            }
            
            const jwt = await new jose.SignJWT({ device: req.device, pool: req.pool })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('2h')
                .sign(JWT_KEY)

            res.json({ token: jwt });
        })
})

export default router