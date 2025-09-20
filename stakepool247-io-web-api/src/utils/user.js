import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export const loadFirestoreUser = async (uid) => {
    return await getFirestore('stakepool247-v2')
        .collection('users')
        .doc(uid)
        .get()
        .then((user) => {
            return user.data()
        })
}

export const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/


export const updateClaimsPoolCount = async (uid, poolCount) => {
    const user = await getAuth().getUser(uid);
    await getAuth().setCustomUserClaims(uid, { poolCount: poolCount, admin: user.customClaims?.admin });
}
