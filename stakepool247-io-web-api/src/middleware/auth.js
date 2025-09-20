import { getAuth } from 'firebase-admin/auth'
import * as jose from 'jose'
import { JWT_KEY } from '../config/jwt.js';

const extractToken = (req) => {
    const bearerHeader = req.headers['authorization'];

    if (bearerHeader) {
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];
        return bearerToken;
    } else {
        // Forbidden
        return null
    }
}

const parseFirebaseAuthToken = async (req, res, next) => {
    const token = extractToken(req)
    if (!token) {
        return next()
    }

    getAuth()
        .verifyIdToken(token)
        .then((decodedToken) => {
            req.uid = decodedToken.uid
            req.isAdmin = decodedToken.admin
            next()
        }).catch((error) => {
            console.error(error)
            next()
        })
}

export const requireAuth = [parseFirebaseAuthToken, async (req, res, next) => {
    if (req.uid) {
        return next()
    }
    return res.sendStatus(403)
}]

export const requireAdmin = [requireAuth, async (req, res, next) => {
    if (req.isAdmin === true) {
        return next()
    }
    return res.sendStatus(403)
}]

const parseJWTAuthToken = async (req, res, next) => {
    const token = extractToken(req)
    if (!token) {
        return next()
    }
    jose.jwtVerify(token, JWT_KEY).then(({payload}) => {
        req.pool = payload.pool
        req.device = payload.device
        req.token = payload
        next()
    }).catch((error) => {
        console.error(error)
        next()
    })
}

export const requireJWTAuth = [parseJWTAuthToken, async (req, res, next) => {
    if (req.pool) {
        return next()
    }
    return res.sendStatus(403)
}]

export const requireValidJWTTRefreshToken = [parseJWTAuthToken, async (req, res, next) => {
    if (req.pool) {
        return next()
    }
    return res.sendStatus(403)
}]
