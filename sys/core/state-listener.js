const venom = require('venom-bot');
const { logger } = require('../logger');

async function stateListener(client) {
    logger.info("{{STATE LISTENER}}: Starting state listener for client...")
    client.onStateChange((state) => {
        // TODO: Listen for account ban and halt execution
        logger.warn(`{{STATE LISTENER}}: State changed: ${state}`);
        const conflicts = [
            venom.SocketState.CONFLICT,
            venom.SocketState.UNPAIRED,
            venom.SocketState.UNLAUNCHED,
        ];
        if (conflicts.includes(state)) {
            logger.warn("{{STATE LISTENER}}: Conflicting sessions - requesting use here");
            client.useHere();
            // Detect a logout
            if (state === venom.SocketState.UNPAIRED)
                logger.error("{{STATE LISTENER}}: Client has logged out of this instance of WhatsApp Web");

        }
    });
}

module.exports = stateListener;
