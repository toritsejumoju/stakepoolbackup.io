import { initializeApp, applicationDefault } from 'firebase-admin/app'

const firebase = initializeApp({
    credential: applicationDefault()
});

export default firebase;