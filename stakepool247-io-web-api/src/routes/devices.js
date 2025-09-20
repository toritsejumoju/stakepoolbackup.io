import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as jose from 'jose'
import { JWT_KEY } from "../config/jwt.js";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { loadAccessiblePools, validatePoolOwner } from "../utils/pool.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
    loadAccessiblePools(req.uid)
        .then(pools => {
            const devices = []
            pools.forEach(pool => {
                pool.devices?.forEach(device => {
                    devices.push({ ...device, pool: pool.poolIdBech32, ticker: pool.ticker })
                })
            })
            res.json(devices);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
});

router.get("/:poolId/:deviceId", requireAuth, async (req, res) => {
    const poolId = req.params.poolId
    const deviceId = req.params.deviceId
    const poolData = await validatePoolOwner(poolId, req.uid, res)
    if (!poolData) {
        return
    }

    const device = poolData.devices?.find(d => d.name === deviceId)

    if (!device) {
        return res.status(404).json({ message: 'Device not found for pool' })
    }

    res.json({...device, pool: poolData.poolIdBech32})
});

router.post("/", requireAuth, async (req, res) => {
    const deviceId = req.body.device
    const externalIp = req.body.externalIp
    const poolId = req.body.pool
    const deviceType = req.body.type
    // TODO: Validate device name

    const poolData = await validatePoolOwner(poolId, req.uid, res)
    if (!poolData) {
        return
    }

    if (poolData.devices?.find(d => d.name === deviceId)) {
        return res.status(400).json({ message: 'Device with the same name already exists' })
    }

    const jwt = await new jose.SignJWT({ device: deviceId, pool: poolId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .sign(JWT_KEY)

    getFirestore('stakepool247-v2')
        .collection("poolData")
        .doc(poolId)
        .update({
            devices: FieldValue.arrayUnion({
                name: deviceId,
                externalIp: externalIp,
                deviceType: deviceType,
                token: jwt
            })
        })
        .then(() => {
            res.json({ jwt });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
});

router.put("/", requireAuth, async (req, res) => {
    const deviceId = req.body.device
    const externalIp = req.body.externalIp
    const poolId = req.body.pool
    const deviceType = req.body.type

    const poolData = await validatePoolOwner(poolId, req.uid, res)
    if (!poolData) {
        return
    }

    const existingDevice = poolData.devices?.find(d => d.name === deviceId)

    if (!existingDevice) {
        return res.status(404).json({ message: 'Device with the name doesn\'t exist for pool' })
    }

    getFirestore('stakepool247-v2')
        .collection("poolData")
        .doc(poolId)
        .update({
            devices: [...poolData.devices?.filter(d => d.name !== deviceId), {
                name: existingDevice.name,
                externalIp: externalIp,
                deviceType: deviceType,
                token: existingDevice.token
            }]
        })
        .then(() => {
            res.json({});
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
});

router.delete("/:poolId/:deviceId", requireAuth, async (req, res) => {
    const poolId = req.params.poolId
    const deviceId = req.params.deviceId

    const poolData = await validatePoolOwner(poolId, req.uid, res)
    if (!poolData) {
        return
    }

    if (!poolData.devices?.find(d => d.name === deviceId)) {
        return res.status(404).json({ message: 'Device not found for specified pool' })
    }

    const poolRef = getFirestore('stakepool247-v2')
        .collection("poolData")
        .doc(poolId)

    poolRef.update({
        devices: poolData.devices?.filter(d => d.name !== deviceId)
    }).then(() => {
            res.json();
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
});

export default router