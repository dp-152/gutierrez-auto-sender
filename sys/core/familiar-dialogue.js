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
    roundToPrecision
} = require("../helper");


// Loading send list from resources/familiar_list.json
// TODO: Load this file from ini parameters
const familiarList = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'resources', 'familiar_list.json'),
    'utf-8'
));

// Function to initiate conversations with familiar accounts
async function familiarStartConversation(client) {

    // Determining the amount of targets to start a conversation with
    const targetAmount = randomInRange(2, 6);

    let excludeTarget = [];

    for (let i = 0; i < targetAmount; ++i) {
        // Taking a random target from send list
        let targetIndex = randomInRange(0, familiarList.contacts.length - 1);
        // Will loop until it finds a contact it has not sent to yet
        while (excludeTarget.includes(targetIndex)){
            targetIndex = randomInRange(0, familiarList.contacts.length - 1);
        }
        // Returns a valid contact object
        const target = await client.getNumberProfile(familiarList.contacts[targetIndex].phone);
        excludeTarget.push(targetIndex);

        await sendRandomMessages(client, target.id._serialized);

        await new Promise(r => setTimeout(r, percentualVariation(15, 15)));
    }
}

async function familiarReply(client, message) {
    // TODO: Determine and track which familiar is replying to
    // TODO: Enforce a limit to reply routine (random number to determine if should send reply tag or not?)

    if (message.body.includes('{{REPLY}}')) {
        await sendRandomMessages(
            client,
            message.from,
            randomInRange(2, 5),
            roundToPrecision(Math.random()) === 1
        );
    }
}

async function sendRandomMessages(client, target, maxMsg = 8, askForReply = true) {
    // Determining the amount of messages to send at once to current target
    const messageAmount = randomInRange(1, maxMsg);

    // Loops for the amount of messages determined on the previous step
    for (let j = 0; j < messageAmount; ++j) {
        // Generates a random lorem ipsum string within the range of 5 to 35 words
        let message = makeIpsum(randomInRange(5, 35));

        // If last message, add the reply tag
        if (j === messageAmount - 1 && askForReply)
            message += "{{REPLY}}";

        client.startTyping(target).then()
            .catch((err) => {
                logger.error(err);
            });

        await new Promise(r => {
            const typingTime = typeTime(message.length, settings.timeouts.typing, settings.timeouts.typing_variance);
            setTimeout(r, typingTime);
        });

        await client.sendText(target, message).catch(err => logger.error(err));
        client.stopTyping(target).then().catch(err => logger.error(err));
    }
}

module.exports = {
    familiarStartConversation,
    familiarReply
}
