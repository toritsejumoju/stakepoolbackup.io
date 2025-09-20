const nodemailer = require("nodemailer");

/**
 * Program uses env variables:
 *      REQUIRED:
 *          MAIL_NOTIF_RECIPIENT (recipient email address for fail notifications)
 *      OPTIONAL:
 *          SERVER_MAIL_SENDER (Sender for mail notifications - defaults to "pool-JSON-loader <pool-json-loader@localhost>")
 *          SERVER_MAIL_HOST (SMTP host - defaults to localhost)
 *          SERVER_MAIL_PORT (SMTP port - defaults to 25)
 *          SERVER_MAIL_SECURE (SMTP secure - defaults to false)
 *          SERVER_MAIL_USER (SMTP user email - defaults to empty)
 *          SERVER_MAIL_PASS (SMTP user password - defaults to empty)
 */

function nodemailerConfig() {
    return {
        host: process.env.SERVER_MAIL_HOST ? process.env.SERVER_MAIL_HOST : "localhost",
        port: process.env.SERVER_MAIL_PORT ? parseInt(process.env.SERVER_MAIL_PORT) : 25,
        secure: (String(process.env.SERVER_MAIL_SECURE) === "true"),
        auth: {
            user: process.env.SERVER_MAIL_USER,
            pass: process.env.SERVER_MAIL_PASS
        }
    };
}

const sendMail = function (subjectLine, htmlContent, sender, errorMetadata) {
    console.log("Sending notification mail. Info: %s", errorMetadata);
    try {
        const transporter = nodemailer.createTransport(nodemailerConfig());
        transporter.sendMail({
            from: process.env.SERVER_MAIL_SENDER ? process.env.SERVER_MAIL_SENDER : sender + "<" + sender + "@localhost>",
            to: process.env.MAIL_NOTIF_RECIPIENT,
            subject: subjectLine,
            html: htmlContent
        }).catch(function (err) {
            console.error("Failed to send notification mail. \nErr: %s. \nFailed process info: %s", err, errorMetadata);
        });
    } catch (err) {
        console.error("Failed to send notification mail. \nErr: %s. \nFailed process info: %s", err, errorMetadata);
    }
};

module.exports = {
    sendMail: function (subjectLine, htmlContent, sender, errorMetadata) {
        return sendMail(subjectLine, htmlContent, sender, errorMetadata);
    }
};

if (! ("MAIL_NOTIF_RECIPIENT" in process.env)) throw new Error("MAIL_NOTIF_RECIPIENT must be set");
