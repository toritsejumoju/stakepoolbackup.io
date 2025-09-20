import { loadFirestoreUser } from "../utils/user.js"


export const loadOwnUser = (req, res, next) => {
    loadFirestoreUser(req.uid)
        .then((user) => {
            req.user = user
            next()
        })
        .catch((error) => {
            console.error(error)
            res.sendStatus(404)
        })
}