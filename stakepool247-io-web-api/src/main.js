import fs from 'fs'
import https from 'https'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import firebase from './utils/firebase.js'
import userRoute from './routes/users.js'
import statsRoute from './routes/stats.js'
import contactRoute from './routes/contacts.js'
import poolRoute from './routes/pools/index.js'
import metricsRoute from './routes/metrics.js'
import devicesRoute from './routes/devices.js'
import alertsRoute from './routes/alerts.js'
import tokenRoute from './routes/token.js'
import blocksRoute from './routes/blocks.js'
import telegramRoute from './routes/telegram.js'

const app = express()
const port = process.env.PORT || 4000
const sslPath = process.env.API_SSL_PATH || '/etc/letsencrypt/live/api-v2.stakepool247.io/'

app.use(cors())
app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send({
    status: 'ok',
    service: 'StakePool247 API v2',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  })
})

app.use('/users', userRoute)
app.use('/stats', statsRoute)
app.use('/contacts', contactRoute)
app.use('/pools', poolRoute)
app.use('/metrics', metricsRoute)
app.use('/devices', devicesRoute)
app.use('/alerts', alertsRoute)
app.use('/token', tokenRoute)
app.use('/blocks', blocksRoute)
app.use('/telegram', telegramRoute)

if (process.env.NODE_ENV === 'production_old') {
  const options = {
    key: fs.readFileSync(`${sslPath}privkey.pem`),
    cert: fs.readFileSync(`${sslPath}fullchain.pem`)
  }

  const server = https.createServer(options, app)
  server.listen(port, () => {
    console.log(`Stakepool247 API listening on port ${port}`)
  })
} else {
  app.listen(port, () => {
    console.log(`Stakepool247 API listening on port ${port}`)
  })
}
