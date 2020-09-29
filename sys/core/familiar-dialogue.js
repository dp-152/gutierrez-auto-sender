const fs = require('fs');
const path = require('path');
const { logger } = require('../logger');
const {
    settings
} = require('../global');
const {
    randomInRange,
    readTextFiles,
    loadFilesInDir,
    typeTime,
    percentualVariation
} = require("../helper");

// Function to initiate conversations with familiar accounts
async function familiarStartConversation(client) {

    // Loading send list from resources/familiar_list.json
    const sendList = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, '..', 'resources', 'familiar_list.json'),
        'utf-8'
    ));

    // TODO: Get these locations through ini parameters
    const sendLines = readTextFiles(path.resolve(__dirname, '..', 'resources', 'familiar_lines.txt'));
    const sendAttachments = loadFilesInDir(path.resolve(__dirname, '..', 'resources', 'attachments')).files;

    // Determining the amount of targets to start a conversation with
    const targetAmount = randomInRange(2, 6);

    let excludeTarget = [];

    for (let i = 0; i < targetAmount; ++i) {
        // Taking a random target from send list
        let targetIndex = randomInRange(0, sendList.contacts.length - 1);
        // Will loop until it finds a contact it has not sent to yet
        while (excludeTarget.includes(targetIndex)){
            targetIndex = randomInRange(0, sendList.contacts.length - 1);
        }
        const target = await client.getNumberProfile(sendList.contacts[targetIndex].phone);
        excludeTarget.push(targetIndex);

        // Determining the amount of messages to send at once to current target
        const messageAmount = randomInRange(1, 8);

        for (let j = 0; j < messageAmount; ++j) {
            const message = sendLines[randomInRange(0, sendLines.length - 1)]

            client.startTyping(target.id._serialized).then()
                .catch((err) => {
                    logger.error(err);
                });

            await new Promise(r => {
               const typingTime = typeTime(message.length, settings.timeouts.typing, settings.timeouts.typing_variance);
               setTimeout(r, typingTime);
            });

            await client.sendText(target.id._serialized, message).catch(err => logger.error(err));
            client.stopTyping(target.id._serialized).then().catch(err => logger.error(err));
        }

        for (let att of sendAttachments) {
            const randomWaitBetweenFiles = percentualVariation(
                settings.timeouts.between_files,
                settings.timeouts.typing_variance
            );

            await new Promise(r => {
               setTimeout(r, randomWaitBetweenFiles * 1000);
            });

            client.sendFile(target.id._serialized, att, path.basename(att)).then().catch(err => logger.error(err));
        }

        await new Promise(r => setTimeout(r, percentualVariation(15, 15)));
    }
}

module.exports = {
    familiarStartConversation
}
