import firebase from './utils/firebase.js'
import { getAuth } from 'firebase-admin/auth';

if (process.argv.length < 4) {
  console.error('Please provide arguments.');
  process.exit(1);
}

const command = process.argv[2];
const uid = process.argv[3];

if (command === 'add-admin') {
  await getAuth().setCustomUserClaims(uid, { admin: true });
} else if (command === 'remove-admin') {
  await getAuth().setCustomUserClaims(uid, { admin: false });
} else if (command === 'get-claims') {
  await getAuth().getUser(uid).then((user) => {
    console.log(user.customClaims);
  });
} else {
  console.error('Invalid command.');
  process.exit(1);
}
