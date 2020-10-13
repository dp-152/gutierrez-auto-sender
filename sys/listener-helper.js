const { logger } = require("./logger");
const { settings, campaignName } = require("./global");
const {
    replaceKeys,
    typeTime
} = require("./helper");

//TODO: Separate relay from auto-reply function
async function sendReply(client, message, match) {
    logger.info(`{{AUTO REPLY}}: Sending reply to received message...`);
    let replyToSend = "";
    if (match)
        replyToSend = settings.relay.reply_onmatch;
    else
        replyToSend = settings.relay.reply_default;

    if (replyToSend === ""){
        logger.warn('{{AUTO REPLY}} Reply string is empty - aborting reply');
        return;
    }

    await new Promise(r => {
        let typingTime = typeTime(
            replyToSend.length,
            settings.timeouts.typing,
            settings.timeouts.typing_variance
            );
        logger.debug(`{{AUTO REPLY}}: Typing timeout is ${typingTime}`);
        setTimeout(r, typingTime);
    });

    client.sendText(message.from, replyToSend)
        .catch((err) => {
            logger.error('{{AUTO REPLY}}: Error sending a reply.');
            logger.error(err);
        });
}

async function relayMessage(client, message) {
    logger.info(`{{RELAY}}: Relaying message to ${settings.relay.number}`);

    const relayedMessage = replaceKeys(
        settings.relay.relay_message_format, {
            phone: message.from.toString().replace("@c.us", ""),
            campaign: campaignName,
            message: message.body
        }).replace("<br>", "\n")

    await new Promise(r => {
        let typingTime = typeTime(
            relayedMessage,
            settings.timeouts.typing,
            settings.timeouts.typing_variance
        );
        logger.debug(`{{RELAY}}: Typing timeout is ${typingTime}`);
        setTimeout(r, typingTime);
    });

    client.sendText(settings.relay.number + "@c.us",relayedMessage)
        .catch((err) => {
            logger.error('{{RELAY}}: Error relaying message.');
            logger.error(err);
    });
}

module.exports = {
    relayMessage,
    sendReply
};
