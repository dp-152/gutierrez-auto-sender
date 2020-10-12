const { logger } = require("./logger");
const { settings, campaignName } = require("./global");
const { replaceKeys } = require("./helper");

//TODO: Separate relay from auto-reply function
async function replyMatch(client, message) {
    logger.info(`{{AUTO REPLY}}: Sending reply to received message...`)
    client.sendText(message.from, settings.relay.reply_onmatch)
        .catch((err) => {
            logger.error('{{AUTO REPLY}}: Error sending a reply.');
            logger.error(err);
        });
}

async function relayMessage(client, message) {
    logger.info(`{{RELAY}}: Relaying message to ${settings.relay.number}`);
    client.sendText(
        settings.relay.number + "@c.us",
        replaceKeys(
            settings.relay.relay_message_format, {
                phone: message.from.toString().replace("@c.us", ""),
                campaign: campaignName,
                message: message.body
            }).replace("<br>", "\n"))
        .catch((err) => {
            logger.error('{{RELAY}}: Error relaying message.');
            logger.error(err);
        });
}

module.exports = {
    relayMessage,
    replyMatch
};
