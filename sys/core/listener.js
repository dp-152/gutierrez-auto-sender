const {logger} = require("../logger");
const {
    settings,
    campaignName
} = require("../global");
const {
    replaceKeys
} = require("../helper");

// Listener thread
async function listener(client) {
    logger.info("Running listener for account");
    client.onMessage((message => {

        // TODO: Add option to use regex match instead of string match
        if (message.body === settings.relay.match && !message.from.includes('@g.us')) {
            client.sendText(
                settings.relay.number + "@c.us",
                replaceKeys(
                    settings.relay.relay_message_format, {
                        phone: message.from.toString().replace("@c.us", ""),
                        campaign: campaignName,
                        message: message.body
                    })
            )
                .catch((err) => {
                    logger.error('Error relaying message.');
                    logger.error(err);
                });
            client.sendText(message.from, settings.relay.reply_onmatch)
                .catch((err) => {
                    logger.error('Error sending a reply.');
                    logger.error(err);
                });
        } else {
            client.sendText(message.from, settings.relay.reply_default);
        }
    }));

}

module.exports = listener;
