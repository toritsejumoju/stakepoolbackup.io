import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'stakepool247_metrics',
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL || false
})