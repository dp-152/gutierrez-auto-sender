const { logger } = require("../logger");
const { settings, campaignName } = require("../global");
const { replaceKeys } = require("../helper");

// Listener thread
async function listener(client) {
    logger.info("{{LISTENER}}: Running listener for account...");
    client.onMessage(message => {
        logger.info(`{{LISTENER}}: Incoming message from ${message.from}...`);
        logger.info(`{{LISTENER}}: Message contents: ${message.body}`);
        // TODO: Add option to use regex match instead of string match
        if (message.body === settings.relay.match && !message.from.includes('@g.us')) {
            logger.info(`{{LISTENER}}: Message has matched criteria. Sending relay and reply`);
            logger.info(`{{LISTENER}}: Relaying message to ${settings.relay.number}`);
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
                    logger.error('{{LISTENER}}: Error relaying message.');
                    logger.error(err);
                });
            logger.info(`{{LISTENER}}: Sending reply to received message...`)
            client.sendText(message.from, settings.relay.reply_onmatch)
                .catch((err) => {
                    logger.error('{{LISTENER}}: Error sending a reply.');
                    logger.error(err);
                });
        } else {
            logger.info("{{LISTENER}}: Message has not matched criteria. Sending default reply...")
            client.sendText(message.from, settings.relay.reply_default);
        }
    });

}

module.exports = listener;
