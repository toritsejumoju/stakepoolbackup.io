import firebase from './utils/firebase.js'
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { allowedMetrics } from "./config/metrics.js"
import { Parser } from "./utils/expressionParser.js"
import { botNotificationsQueue } from './config/queue.js'
import { pool } from './config/db.js'
import moment from 'moment'
import cron from 'node-cron'

const processAlertQuery = async (expression, uid, device_id) => {
    const parser = new Parser(expression, allowedMetrics)
    const parsed = parser.Parse()
    const queryVars = parsed.QueryVars()

    const functions = extractQueryFunctions(queryVars)
    const defaultFilter = 'uid=? AND device_id=?'
    const defaultParams = [uid, device_id]

    const functionQueries = functions.map(func => {
        if (func.type === 'last') {
            const query = `SELECT metric_value as value FROM metrics WHERE metric_name=? AND time > ? AND ${defaultFilter} ORDER BY time DESC LIMIT 1`
            const params = [func.field, moment().subtract(func.args[0], 'seconds'), ...defaultParams]
            return {
                func,
                query,
                params
            }
        }
        if (func.type === 'count') {
            const query = `SELECT COUNT(metric_value) as value FROM metrics WHERE metric_name=? AND time > ? AND ${defaultFilter}`
            const params = [func.field, moment().subtract(func.args[0], 'seconds'), ...defaultParams]
            return {
                func,
                query,
                params
            }
        }
        if (func.type === 'bucket') {
            const query = `SELECT ${func.func}(metric_value) as value FROM metrics WHERE metric_name=? AND time > ? AND ${defaultFilter}`
            const params = [func.field, moment().subtract(func.args[0], 'seconds'), ...defaultParams]
            return {
                func,
                query,
                params
            }
        }
        throw new Error("Unknown function type found")
    })

    const functionCalls = functionQueries.map(func => {
        let count = 0
        const convertedQuery = func.query.replace(/\?/g, () => {
            count++
            return `$${count}`
        })
        return new Promise(async (resolve, reject) => {
            try {
                const result = await pool.query(convertedQuery, func.params)
                resolve({
                    func: func.func,
                    result
                })
            } catch (e) {
                reject(e)
            }
        })
    })

    const functionResults = await Promise.all(functionCalls)
    
    return validateResult(queryVars, functionResults)
}

const validateResult = (queryVars, functionResults) => {
    if (queryVars.connector === 'or') {
        return validateResult(queryVars.left, functionResults) || validateResult(queryVars.right, functionResults)
    }
    if (queryVars.connector === 'and') {
        return validateResult(queryVars.left, functionResults) && validateResult(queryVars.right, functionResults)
    }
    // '<', '<=', '>', '>=', '=', '<>'
    if (queryVars.operation === '<') {
        return validateResult(queryVars.left, functionResults) < validateResult(queryVars.right, functionResults)
    }
    if (queryVars.operation === '<=') {
        return validateResult(queryVars.left, functionResults) <= validateResult(queryVars.right, functionResults)
    }
    if (queryVars.operation === '>') {
        return validateResult(queryVars.left, functionResults) > validateResult(queryVars.right, functionResults)
    }
    if (queryVars.operation === '>=') {
        return validateResult(queryVars.left, functionResults) >= validateResult(queryVars.right, functionResults)
    }
    if (queryVars.operation === '==') {
        return validateResult(queryVars.left, functionResults) === validateResult(queryVars.right, functionResults)
    }
    if (queryVars.operation === '<>') {
        return validateResult(queryVars.left, functionResults) !== validateResult(queryVars.right, functionResults)
    }

    if (queryVars.func) {
        const funcResult = functionResults.find(f => compareFunction(f.func, queryVars))
        // console.log(funcResult)
        return funcResult.result.rows?.[0]?.value
    }

    return parseFloat(queryVars)
}

const compareFunction = (func1, func2) => {
    return func1.type === func2.type && func1.func === func2.func && func1.field === func2.field && func1.args[0] === func2.args[0]
}

const extractQueryFunctions = (queryVars) => {
    if (queryVars.func) {
        return [queryVars]
    }
    let parts = []
    if (queryVars.left) {
        parts = [...parts, ...extractQueryFunctions(queryVars.left)]
    }
    if (queryVars.right) {
        parts = [...parts, ...extractQueryFunctions(queryVars.right)]
    }
    return parts
}

const processAlerts = async () => {
    const alerts = await getFirestore('stakepool247-v2')
        .collection('alertConfig')
        // .where('uid', '==', uid)
        .where('enabled', '==', true)
        .get()
    
    alerts.docs.forEach(async (alert) => {
        const alertConfiguration = alert.data()
        const expression = alertConfiguration.expression;
        const result = await processAlertQuery(expression, alertConfiguration.uid, alertConfiguration.deviceName)

        const triggerRef = getFirestore('stakepool247-v2')
            .collection('alertTriggers')
            .doc(alert.id)
        
        const triggered = await triggerRef.get()
        
        if (result && !triggered.data()) {
            await triggerRef.set({
                pool: alertConfiguration.pool,
                configName: alertConfiguration.name,
                deviceName: alertConfiguration.deviceName,
                level: alertConfiguration.level,
                active: result,
                lastUpdate: moment(),
                history: [{
                    active: result,
                    time: moment()
                }]
            })
            botNotificationsQueue.add({
                receivers: {
                    pools: [alertConfiguration.pool]
                },
                type: 'alert',
                data: {
                    message: `Alert Triggered: ${alertConfiguration.name} for ${alertConfiguration.deviceName}`
                }
            })
            console.log('Creating new trigger for ', alert.id)
        } else if (triggered.data() && triggered.data().active !== result) {
            await triggerRef.update({
                active: result,
                lastUpdate: moment(),
                configName: alertConfiguration.name,
                level: alertConfiguration.level,
                history: [...triggered.data().history, {
                    active: result,
                    time: moment()
                }].slice(-5)
            })
            botNotificationsQueue.add({
                receivers: {
                    pools: [alertConfiguration.pool]
                },
                type: 'alert',
                data: {
                    message: `Alert Triggered: ${alertConfiguration.name} for ${alertConfiguration.deviceName}`
                }
            })
            console.log('Updating trigger value for ', alert.id)
        }
    })
}

const schedule = process.env.ALERTS_CRON ? process.env.ALERTS_CRON : "0 */5 * * * *";
console.info("Scheduling alert processor at ", schedule);
cron.schedule(schedule, () => {
    console.info("Processing alerts");
    processAlerts();
});
