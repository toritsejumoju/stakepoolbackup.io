import { Router } from "express";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { allowedMetrics } from "../config/metrics.js";
import { requireAuth } from "../middleware/auth.js";
import { Parser } from "../utils/expressionParser.js";
import { randomUUID } from 'crypto'
import { loadAccessiblePools, loadOwnedPools, validatePoolOwner } from "../utils/pool.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
    const ownedPools = await loadOwnedPools(req.uid)
    getFirestore('stakepool247-v2')
        .collection("alertConfig")
        .where('pool', 'in', ownedPools.map(pool => pool.id))
        .get()
        .then((alertConfigs) => {
            res.json(alertConfigs.docs.map((alert) => ({ ...alert.data(), id: alert.id })));
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
})

router.post("/", requireAuth, async (req, res) => {
    const { id, expression, name, deviceName, pool, level, enabled } = req.body

    if (!name) {
        console.error('Name not specified while saving alert definition')
        return res.status(400).json({ message: 'Name not specified while saving alert definition' })
    }

    const poolData = await validatePoolOwner(pool, req.uid, res)
    if (!poolData) {
        return
    }

    if (!poolData.devices?.find(d => d.name === deviceName)) {
        return res.status(404).json({message: 'Device not associated with pool'})
    }

    try {
        const parser = new Parser(expression, allowedMetrics)
        const parsed = parser.Parse()
        parsed.QueryVars()

        if (id) {
            getFirestore('stakepool247-v2').runTransaction(async t => {
                const configRef = getFirestore().collection("alertConfig").doc(id)
                const alertConfig = await t.get(configRef)
                t.update(configRef, {
                    ...alertConfig.data(),
                    expression,
                    pool,
                    deviceName,
                    level,
                    name,
                    enabled
                })
                res.json({ expression });
            })
        } else {
            getFirestore('stakepool247-v2')
                .collection("alertConfig")
                .add({
                    expression,
                    deviceName,
                    level,
                    pool,
                    name,
                    enabled
                })
                .then(() => {
                    res.json({ expression });
                })
                .catch((error) => {
                    console.error(error);
                    res.status(500).json();
                });
        }
    } catch (e) {
        console.error(e.message)
        res.status(400).json({ message: e.message, token: e?.token })
    }
})

router.get("/triggers", requireAuth, async (req, res) => {
    const accessiblePools = await loadAccessiblePools(req.uid)
    getFirestore('stakepool247-v2')
        .collection("alertTriggers")
        .where('pool', 'in', accessiblePools.map(pool => pool.id))
        .get()
        .then((alertTriggers) => {
            res.json(alertTriggers.docs.map((alert) => ({ ...alert.data(), id: alert.id })));
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
})

router.get("/allowedFields", requireAuth, async (req, res) => {
    res.json(allowedMetrics)
})

router.get("/:alertId", requireAuth, async (req, res) => {
    getFirestore('stakepool247-v2')
        .collection("alertConfig")
        .doc(req.params.alertId)
        .get()
        .then(async (alertConfig) => {
            const alert = {...alertConfig.data(), id: alertConfig.id}
            const ownedPools = await loadOwnedPools(req.uid)
            if (ownedPools.find(pool => pool.id === alert.pool)) {
                res.json(alert);
            } else {
                res.status(404).json()
            }
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json();
        });
})

export default router
