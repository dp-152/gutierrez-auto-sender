const { logger } = require("../logger");
const { settings } = require("../global");
const { familiarReply } = require('./familiar-dialogue');
const { sendReply, relayMessage } = require('../listener-helper');

// Listener thread
async function messageListener(client) {
    logger.info("{{MSG LISTENER}}: Running message listener for account...");
    client.onMessage(message => {
        if (message.from.includes('@g.us'))
            return;
        logger.info(`{{MSG LISTENER}}: Incoming message from ${message.from}...`);
        logger.info(`{{MSG LISTENER}}: Message contents: ${message.body}`);
        // TODO: Add option to use regex match instead of string match
        if (settings.relay.enabled) {
            if (message.body === settings.relay.match) {
                logger.info(`{{MSG LISTENER}}: Message has matched criteria. Sending relay and reply`);
                sendReply(client, message, true);
                relayMessage(client, message);
            }

            else {
                logger.info("{{MSG LISTENER}}: Message has not matched any criteria. Sending default reply...");
                sendReply(client, message, false);
            }
        }
        /*
        else if (message.body.includes('{{REPLY}}')) {
            familiarReply(client, message);
        }
         */
    });
}

module.exports = messageListener;
