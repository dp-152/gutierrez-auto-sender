const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const {
    settings
} = require('../global');
const {
    randomInRange,
    makeIpsum,
    typeTime,
    percentualVariation,
    pluralSuffix
} = require("../helper");


// Loading send list from resources/familiar_list.json
// TODO: Load this file from ini parameters
const familiarList = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'resources', 'familiar_list.json'),
    'utf-8'
));

// Function to initiate conversations with familiar accounts
async function familiarStartConversation(client) {

    logger.info(`{{FAMILIAR}}: Starting conversation routine`);

    // Determining the amount of targets to start a conversation with
    const targetAmount = randomInRange(2, 6);
    logger.info(`{{FAMILIAR}}: Will speak to ${targetAmount} contacts out of ${familiarList.contacts.length}`);

    let excludeTarget = [];

    for (let i = 0; i < targetAmount; ++i) {
        // Taking a random target from send list
        let targetIndex = randomInRange(0, familiarList.contacts.length - 1);
        logger.debug(`{{FAMILIAR}}: Selected target at index ${targetIndex}`);
        // Will loop until it finds a contact it has not sent to yet
        while (excludeTarget.includes(targetIndex)) {
            logger.debug(`{{FAMILIAR}}: Target has already been spoken to. Selecting new target.`)
            targetIndex = randomInRange(0, familiarList.contacts.length - 1);
            logger.debug(`{{FAMILIAR}}: Selected target at index ${targetIndex}`);
        }
        // Returns a valid contact object
        const target = await client.getNumberProfile(familiarList.contacts[targetIndex].phone);
        logger.info(`{{FAMILIAR}}: Target is ${target.id._serialized}`);
        excludeTarget.push(targetIndex);
        logger.debug(`{{FAMILIAR}}: Pushed target to exclusion list`);

        await sendRandomMessages(client, target.id._serialized);

        await new Promise(r => setTimeout(r, percentualVariation(15, 15)));
        logger.info('{{FAMILIAR}}: Sleeping for 15 seconds...')
    }
}

async function familiarReply(client, message) {
    // TODO: Determine and track which familiar is replying to
    // TODO: Enforce a limit to reply routine (random number to determine if should send reply tag or not?)

    if (message.body.includes('{{REPLY}}')) {
        logger.info(`{{FAMILIAR}}: Incoming reply tag from ${message.from} - Starting reply routine...`)
        await sendRandomMessages(
            client,
            message.from,
            randomInRange(2, 5),
            randomInRange(0,1, 0) === 1
        );
    }
}

async function sendRandomMessages(client, target, maxMsg = 8, askForReply = true) {
    // Determining the amount of messages to send at once to current target
    const messageAmount = randomInRange(1, maxMsg);
    logger.info(`{{FAMILIAR}}: Will send a total of ${messageAmount} ` +
        `message${pluralSuffix(messageAmount, 's')} to current target.`);
    logger.info(`{{FAMILIAR}}: Will ${askForReply ? '' : 'NOT '}ask for reply in this interaction`);

    // Loops for the amount of messages determined on the previous step
    for (let j = 0; j < messageAmount; ++j) {
        // Generates a random lorem ipsum string within the range of 5 to 35 words
        let message = makeIpsum(randomInRange(5, 35));

        // If last message, add the reply tag
        if (j === messageAmount - 1 && askForReply)
            message += "{{REPLY}}";

        logger.info(`{{FAMILIAR}}: Generated message: ${message}`);
        logger.debug("{{FAMILIAR}}: Started typing");
        client.startTyping(target).then()
            .catch((err) => {
                logger.error('{{FAMILIAR}}: Error trying to start typing - ' + err);
            });

        await new Promise(r => {
            const typingTime = typeTime(message.length, settings.timeouts.typing, settings.timeouts.typing_variance);
            logger.info(`{{FAMILIAR}}: Typing timeout is ${typingTime}ms - sleeping`);
            setTimeout(r, typingTime);
        });

        await client.sendText(target, message).catch(err => {
            logger.error('{{FAMILIAR}}: Error sending message - ' + err);
        });
        client.stopTyping(target).then().catch(err => {
            logger.error('{{FAMILIAR}}: Error trying to stop typing - ' + err);
        });
        logger.debug("{{FAMILIAR}}: Stopped typing");
    }
}

module.exports = {
    familiarStartConversation,
    familiarReply
}
