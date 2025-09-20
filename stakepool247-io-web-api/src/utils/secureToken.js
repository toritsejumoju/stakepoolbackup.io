import { randomBytes } from 'crypto'

export const generateValidationToken = (length = 48) => {
    return new Promise((resolve, reject) => {
        randomBytes(length, function(err, buffer) {
            if (err) {
                return reject(err)
            }
            resolve(buffer.toString('hex'))
        });
    })
}
