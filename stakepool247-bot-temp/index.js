require("dotenv").config();
const { Telegraf, Telegram } = require("telegraf");
const Queue = require("bull");
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldPath } = require("firebase-admin/firestore");

const firebase = initializeApp({
    credential: applicationDefault(),
});

const botNotificationsQueue = new Queue(
    `${process.env.QUEUE_PREFIX}bot-notifications`
);

// Register commands
const telegram = new Telegram(process.env.BOT_TOKEN);
telegram
    .setMyCommands([
        {
            command: "start",
            description: "Start interacting with bot",
        },
        {
            command: "help",
            description: "Show available commands",
        },
        {
            command: "login",
            description: "Go to login page",
        },
        {
            command: "pools",
            description: "List your pools",
        },
        {
            command: "notifications",
            description: "Enable notification for this chat",
        },
    ])
    .then((res) => console.log("Set commands response:", res));

const authCommands = ["/pools", "/notifications"];

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(async (ctx, next) => {
    if (
        authCommands.findIndex((com) => ctx?.message?.text?.startsWith(com)) !==
        -1
    ) {
        const userDocs = await getFirestore()
            .collection("users")
            .where("telegramData.id", "==", ctx.from.id)
            .get();
        if (userDocs.docs.length === 0) {
            return ctx.reply(
                `Authentication required. Please go to your account on ${process.env.BASE_DOMAIN} and link your Telegram account`
            );
        }
        // TODO: Validate telegram token
        const user = userDocs.docs[0];
        ctx.userData = { ...user.data(), id: user.id };
    }
    await next();
});

bot.start((ctx) => ctx.reply("Welcome"));
bot.help((ctx) => {
    // console.log(ctx.from.id)
    // console.log(ctx.chat.id)
    ctx.reply("Lorem ipsum");
});
bot.command("login", (ctx) => {
    ctx.reply(
        `Go to your profile on ${process.env.BASE_DOMAIN} and link telegram account`
    );
});
bot.command("pools", async (ctx) => {
    const ownedPools = await getFirestore()
        .collection("poolData")
        .where("owner", "==", ctx.userData.id)
        .get();
    const sharedPools = await getFirestore()
        .collection("poolData")
        .where("allowRead", "array-contains", ctx.userData.id)
        .get();

    const pools = [];
    ownedPools.docs.forEach((doc) => pools.push({ ...doc.data(), id: doc.id }));
    sharedPools.docs.forEach((doc) =>
        pools.push({ ...doc.data(), id: doc.id })
    );

    ctx.reply(`Your pools:\n${pools.map((p) => p.ticker).join("\n")}`);
});
bot.command("notifications", async (ctx) => {
    const existingChats = await getFirestore()
        .collection("telegramChats")
        .where("chatId", "==", ctx.chat.id)
        .where("user", "==", ctx.userData.id)
        .get();
    const name =
        ctx.chat.type === "private" ? ctx.chat.first_name : ctx.chat.title;
    let chatInfo = {
        chatId: ctx.chat.id,
        name: name,
        user: ctx.userData.id,
        type: ctx.chat.type,
        allPools: true,
        notificationTypes: ["alert", "new_block"],
    };
    if (existingChats.docs.length === 0) {
        await getFirestore().collection("telegramChats").add(chatInfo);
    } else {
        await getFirestore()
            .collection("telegramChats")
            .doc(existingChats.docs[0].id)
            .set({ name: name }, { merge: true });
    }

    ctx.reply(
        `Notifications for this chat enabled. Go to  ${process.env.BASE_DOMAIN}profile to configure what notifications to receive.`
    );
});
bot.launch();

// bot.telegram.sendMessage()

/*
Structure:
{
    "receivers": {
        "users": [<id>],
        "pools": [<id>],
        "chats": [<id>]
    },
    "type": "alert" | "new_block" | "new_epoch" | "epoch_slots_uploaded",
    "data": {
        "message": "",
        ...
    },
}
*/
botNotificationsQueue.process(async (job, done) => {
    const data = job.data;
    console.log("Processing message", data.type, data.data.message);
    const receivingUserIds = [];
    const receivingChats = new Set();
    const relevantPools = {};
    data.receivers?.chats?.forEach((chat) => receivingChats.add(chat));
    if (data?.receivers?.pools) {
        const poolDocs = await getFirestore()
            .collection("poolData")
            .where(FieldPath.documentId(), "in", data.receivers.pools)
            .get();
        if (poolDocs.docs.length !== 0) {
            poolDocs.docs.forEach((doc) => {
                relevantPools[doc.id] = doc.data();
                if (doc.data().owner) {
                    receivingUserIds.push(doc.data().owner);
                }
                if ((doc.data().allowRead || []).length > 0) {
                    doc.data().allowRead.forEach((u) =>
                        receivingUserIds.push(u)
                    );
                }
            });
        }
    }
    if (receivingUserIds.length > 0 || data?.receivers?.users) {
        const chatDocs = await getFirestore()
            .collection("telegramChats")
            .where("notificationTypes", "array-contains", data.type)
            .where(
                "user",
                "in",
                receivingUserIds.concat(data?.receivers?.users || [])
            )
            .get();
        if (chatDocs.docs.length !== 0) {
            chatDocs.docs
                .map((doc) => doc.data())
                .filter((doc) => doc.chatId)
                .forEach((doc) => receivingChats.add(doc.chatId));
        }
    }
    if (receivingChats.size === 0) {
        console.log("No users found with telegram accounts registered");
        return done();
    }

    if (data.type === "alert") {
        receivingChats.forEach((userId) => {
            bot.telegram.sendMessage(userId, data.data.message);
        });
    }
    if (data.type === "new_block") {
        // TODO: Remove debug user sending all updates
        receivingChats.add(5413302899);
        receivingChats.forEach((userId) => {
            const pool = relevantPools[data.data.poolId];
            const poolTicker = (pool?.ticker || "").toUpperCase();
            const blockUrlText = data.data.blockUrl ? `\n\nBlock info at: [cardanoscan.io](${data.data.blockUrl})` : '';
            const blockInEpochText = `${data.data.slotNo} of ${data.data.epochData.epochSlots}`;
            const moreInfoText = `More info: [stakepool247.io](${process.env.BASE_DOMAIN}statistics?pool=${data.data.poolId}&epoch=latest)`;
            const failedReason =
                data.data.status === "failed"
                    ? `\nℹ️Failed reason: ${data.data.failedReason.replace('_', '\\_')} ${data.data.comment ? `(${data.data.comment})` : ''}`
                    : "";
            let statusEmoji = data.data.status === "failed" ? "❌" : "✅";
            if (
                data.data.status === "failed" &&
                data.data.failedReason === "SLOT_BATTLE"
            ) {
                statusEmoji = "⚔️";
            }
            bot.telegram.sendMessage(
                userId,
                `*Block status updated! [${poolTicker}] ${statusEmoji}*\n⌛Epoch: ${data.data.epoch} (block ${blockInEpochText})\n🧱Block: ${data.data.slot}\n${statusEmoji}Status: ${data.data.status}${failedReason}${blockUrlText}\n\n${moreInfoText}`,
                { parse_mode: "Markdown", disable_web_page_preview: true }
            );
        });
    }
    if (data.type === "new_epoch") {
        //TODO: Implement new epoch message
    }
    if (data.type === "epoch_slots_uploaded") {
        // TODO: Send notification on epoch data upload
    }
    done();
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
