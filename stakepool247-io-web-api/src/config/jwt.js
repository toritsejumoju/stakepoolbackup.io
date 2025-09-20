import { createSecretKey } from 'crypto'
const JWT_SECRET = process.env.JWR_SECRET || 'secret-jwt-singning-key'
export const JWT_KEY = createSecretKey(JWT_SECRET, 'utf-8');