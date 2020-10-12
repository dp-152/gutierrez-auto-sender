const { logger } = require("../logger");
const { settings, campaignName } = require("../global");
const { familiarReply } = require('./familiar-dialogue');
const { autoReply } = require('./auto-reply');

// Listener thread
async function listener(client) {
    logger.info("{{LISTENER}}: Running listener for account...");
    client.onMessage(message => {
        logger.info(`{{LISTENER}}: Incoming message from ${message.from}...`);
        logger.info(`{{LISTENER}}: Message contents: ${message.body}`);
        // TODO: Add option to use regex match instead of string match
        if (message.body === settings.relay.match && !message.from.includes('@g.us')) {
            autoReply(client, message);
        }
        else if (message.body.includes('{{REPLY}}')) {
            familiarReply(client, message);
        }
        else {
            logger.info("{{LISTENER}}: Message has not matched any  criteria. Sending default reply...")
            client.sendText(message.from, settings.relay.reply_default);
        }
    });
}

module.exports = listener;
