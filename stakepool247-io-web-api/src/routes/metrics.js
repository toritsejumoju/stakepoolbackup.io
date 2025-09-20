import { query, Router } from "express";
import { requireAuth, requireJWTAuth } from "../middleware/auth.js";
import { pool } from '../config/db.js';
import moment from 'moment';
import { allowedMetrics, metricFields } from "../config/metrics.js";
import { parseBucketSize } from "../utils/time.js";
import { rowsToMetricsMap } from "../utils/metrics.js";
import { loadAccessiblePools, loadAllPools } from "../utils/pool.js";

const router = Router();

const MIN_POINTS = 10
const MAX_POINTS = 2000
const DEFAULT_POINTS = 100

router.get("/", requireAuth, async (req, res) => {
    const uid = req.uid
    const { startTime, endTime, metrics, deviceIDs, pools, maxPoints } = req.query
    let metricsArray = (metrics || '').split(',').filter(id => id !== '')
    const devIDs = (deviceIDs || '').split(',').filter(id => id !== '')
    const poolIDs = (pools || '').split(',').filter(id => id !== '')

    const points = Math.max(Math.min(maxPoints || DEFAULT_POINTS, MAX_POINTS), MIN_POINTS)

    metricsArray = metricsArray.filter(metric => allowedMetrics.indexOf(metric) != -1)

    const { table, bucketSize } = parseBucketSize(startTime, endTime, points)

    if (table === null) {
        return res.status(400).json({message: 'Bad time range'})
    }
    
    const queryParams = []

    let readPools
    if (req.isAdmin) {
        readPools = await loadAllPools()
    } else {
        readPools = await loadAccessiblePools(req.uid)
    }

    let query = ''
    if (table.aggregated) {
        query = `SELECT time_bucket('${table.bucketSizeText}'::INTERVAL, time) as bucket, device_id, metric_name, metric_value_min, metric_value_max, metric_value_avg from ${table.table} `
    } else {
        query = `SELECT time_bucket('${bucketSize.name}'::INTERVAL, time) as bucket, device_id, metric_name, min(metric_value) as metric_value_min, max(metric_value) as metric_value_max, avg(metric_value) as metric_value_avg from ${table.table} `
    }
    let offsetCounter = 1

    if (poolIDs.length != 0) {
        readPools = readPools.filter(p => poolIDs.includes(p.id))
    }
    if (readPools.length === 0) {
        return res.json([])
    }
    query += ` WHERE uid IN (${readPools.map((_, index) => '$' + (index + offsetCounter)).join(', ')})`
    readPools.forEach(p => queryParams.push(p.id))
    offsetCounter += readPools.length

    const startDateTime = moment(startTime)
    const endDateTime = moment(endTime)

    query += ` AND time > $${offsetCounter} AND time < $${offsetCounter + 1}`
    offsetCounter += 2
    queryParams.push(startDateTime)
    queryParams.push(endDateTime)

    if (metricsArray.length != 0) {
        query += ` AND metric_name IN (${metricsArray.map((_, index) => '$' + (index + offsetCounter)).join(', ')})`
        metricsArray.forEach(metric => queryParams.push(metric))
        offsetCounter += metricsArray.length
    }

    if (devIDs.length != 0) {
        query += ` AND device_id IN (${devIDs.map((_, index) => '$' + (index + offsetCounter)).join(', ')})`
        devIDs.forEach(device => queryParams.push(device))
        offsetCounter += devIDs.length
    }

    query += ' GROUP BY device_id, metric_name, bucket'

    console.log(query)

    pool.query(query, queryParams).then(result => {
        res.json(rowsToMetricsMap(result.rows))
    }).catch(error => {
        console.error(error)
        res.status(500).json()
    })

});

router.post("/", requireJWTAuth, async (req, res) => {
    // const uid = req.uid
    const deviceId = req.device

    const time = moment(req.body.time).toISOString()
    const receivedMetrics = Object.entries(req.body.metrics)

    const validMetrics = receivedMetrics.filter(([key, value]) => allowedMetrics.indexOf(key) != -1).filter(([key, value]) => typeof value === 'number')
    const invalidMetrics = receivedMetrics.filter((val) => validMetrics.indexOf(val) == -1)

    if (validMetrics.length == 0) {
        return res.status(400).json({message: 'No valid metrics received', invalidMetrics: invalidMetrics})
    }

    let offsetCounter = 1
    const dbValueCount = 5
    let query = `INSERT INTO metrics (time, device_id, uid, metric_name, metric_value) VALUES `
    query += validMetrics.map((s, index) => {
        let subQuery = '('
        subQuery += Array.from({length:dbValueCount},(v,k)=>k+offsetCounter).map(val => `\$${val}`).join(', ')
        subQuery += ')'
        offsetCounter += dbValueCount
        return subQuery
    }).join(', ')
    console.log(query)

    const queryParams = validMetrics.map(([key, value]) => ([time, deviceId, req.pool, key, value])).flat()

    pool.query(query, queryParams).then(result => {
        res.json(result.rows)
    }).catch(error => {
        console.error(error)
        res.status(500).json()
    })
})

router.get("/fields", requireAuth, async (req, res) => {
    res.json(metricFields)
})

export default router;
