const fs = require('fs').promises;
const path = require('path');
const {ReportLog} = require("../reportlog");
const { logger, report } = require('../logger');
const {
    getDateString,
    loadFilesInDir,
    percentualVariation,
    readTextFiles,
    roundToPrecision,
    replaceKeys,
    typeTime
} = require('../helper');
const {
    sendListFile,
    campaignDir,
    settings,
    global
} = require('../global');
const {
    familiarStartConversation,
} = require('./familiar-dialogue');


// Setting counters for sleep and deep sleep routines
let sleepEveryCounter = 0;
let deepSleepEveryCounter = 0;
let familiarConversationCounter = 0;

// Mass sender thread
async function massSend(client) {

    // Load send list passed as --send argument
    const sendList = JSON.parse(await fs.readFile(sendListFile, 'utf-8'));

    logger.info(`{{MASS SEND}}: Campaign name is: ${path.dirname(campaignDir)}`);

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    logger.info("{{MASS SEND}}: Probing campaign dir for text files and attachments...")
    const campaignContent = await loadFilesInDir(campaignDir);
    logger.info(`{{MASS SEND}}: Loaded campaign files: ${JSON.stringify(campaignContent, null, 4)}`)

    // TODO: Add option to send links with preview
    // TODO: Add option to send contacts
    logger.info("{{MASS SEND}}: Loading campaign text...")
    const campaignText = await readTextFiles(campaignContent.text);
    logger.info("{{MASS SEND}}: Text loaded")

    // Sleep for 5 seconds after init, before starting send job
    logger.info("{{MASS SEND}}: Sleeping for 5 seconds after init...")
    await new Promise(resolve => {
        setTimeout(resolve, 5000);
    });

    // Campaign Report Log ;
    logger.info("{{MASS SEND}}: Opening report log file")
    let logDate = getDateString(
        new Date(),
        "{{year}}-{{month}}-{{day}}_{{hour}}-{{minutes}}-{{seconds}}.{{milliseconds}}");
    const logPath = path.resolve(campaignDir, 'logs', 'csv', `Report_${settings.instance.name}_${logDate}.csv`);
    let finalReport = new ReportLog(logPath);

    logger.info("{{MASS SEND}}: Starting mass send job...");

    logger.info(`{{MASS SEND}}: Send list has a total of ${sendList.contacts.length} targets`)
    report.info({
        message: "SendListTotalTargets",
        total: sendList.contacts.length,
        timestamp: Math.floor(new Date().getTime() / 1000)
    });

    const startingIndex = global.vars.sendListIndex

    // Iterates through contact list from JSON
    sender_main_loop:
        for (let contact of sendList.contacts.slice(startingIndex)) {
            while (!global.vars.clientIsConnectedFlag) {
                if (client !== undefined) {
                    logger.warn("{{MASS SEND}}: Client is disconnected but still alive." +
                        " Sleeping for 15 seconds");
                    await new Promise(resolve => { setTimeout(resolve, 15 * 1000); });
                } else {
                    logger.crit(`{{MASS SEND}}:  Client has been killed.` +
                        ` Halting mass send at ${global.vars.sendListIndex} sends`);
                    break sender_main_loop;
                }
            }

            ++global.vars.sendListIndex;
            logger.info(`{{MASS SEND}}: Send Job Progress: Currently at target ${global.vars.sendListIndex}` +
                ` out of ${sendList.contacts.length}`);

            let targetID = contact.phone + "@c.us";

            // Checks if profile is valid. If not, returns int 404
            let profile = await client.getNumberProfile(targetID)
                .catch((err) => {
                    logger.error('{{MASS SEND}}: Error getting profile number.');
                    logger.error(err);
                });

            if (profile !== 404) {
                logger.info(`{{MASS SEND}}: Retrieved profile data: - Account: ${profile.id.user}
                                                                        - Is business? ${profile.isBusiness}.
                                                                        - Can receive messages? ${profile.canReceiveMessage}.`);

                targetID = profile.id._serialized;

                logger.info(`{{MASS SEND}}: Target: ${contact.name} - ${profile.id.user}`);
                logger.info("{{MASS SEND}}: Started sending to contact");

                let totalTypingTime = 0;

                for (let message of campaignText) {

                    message = replaceKeys(message, contact);

                    client.startTyping(targetID).then()
                        .catch((err) => {
                            logger.error('{{MASS SEND}}: Error trying to start typing.');
                            logger.error(err);
                        });
                    logger.debug("{{MASS SEND}}: Started typing");

                    await new Promise(resolve => {
                        let typingTime = typeTime(
                            message.length,
                            settings.timeouts.typing,
                            settings.timeouts.typing_variance
                        );
                        totalTypingTime += typingTime;
                        logger.info(`{{MASS SEND}}: Typing timeout is ${typingTime}ms - sleeping`);
                        setTimeout(resolve, typingTime);
                    });

                    await client.sendText(targetID, message)
                        .catch((err) => {
                            logger.error('{{MASS SEND}}: Error sending message.');
                            logger.error(err);
                        });
                    logger.info(`{{MASS SEND}}: Typed text: ${message}`);

                    client.stopTyping(targetID).then()
                        .catch((err) => {
                            logger.error('{{MASS SEND}}: Error trying to stop typing.');
                            logger.error(err);
                        });
                    logger.debug("{{MASS SEND}}: Stopped typing");
                }

                report.info({
                        message: "TypingTime",
                        total: totalTypingTime,
                        number: contact.phone,
                        timestamp: Math.floor(new Date().getTime() / 1000)
                    });

                let totalAttachmentTime = 0;

                for (let attachment of campaignContent.files) {
                    const randomBetweenFiles = percentualVariation(
                        settings.timeouts.between_files,
                        settings.timeouts.typing_variance
                    );
                    await new Promise(resolve => {
                        logger.info(
                            `{{MASS SEND}}: Attachment timeout is` +
                            ` ${roundToPrecision(randomBetweenFiles, 2)} seconds - sleeping`);
                        setTimeout(resolve,
                            randomBetweenFiles * 1000);
                    });
                    logger.info("{{MASS SEND}}: Sending attachment:");
                    client.sendFile(targetID, attachment, path.basename(attachment))
                        .catch((err) => {
                            logger.error('{{MASS SEND}}: Error trying to send file.');
                            logger.error(err);
                        });
                    logger.info(`{{MASS SEND}}: Sent ${path.basename(attachment)} as file`);

                    totalAttachmentTime += Math.floor(randomBetweenFiles * 1000);
                }

                report.info({
                    message: "AttachmentTime",
                    total: totalAttachmentTime,
                    number: contact.phone,
                    timestamp: Math.floor(new Date().getTime() / 1000)
                });

                logger.info("{{MASS SEND}}: Finished sending to contact");

                logger.info("{{MASS SEND}}: Writing data to report log.");
                /** ReportLog
                 * @param {string}  targetID    Phone number
                 * @param {boolean}    status      Sent status
                 */
                await finalReport.pushLog(contact.phone, true);

            } else {
                logger.info(`{{MASS SEND}}: ${contact.name} ${contact.phone} - Invalid or nonexistent contact - skipping`);
                report.info({ message: "Invalid or nonexistent contact - skipping", number: contact.phone, status: false, timestamp: Math.floor(new Date().getTime() / 1000) });

                /** ReportLog */
                await finalReport.pushLog(contact.phone, false);
            }

            await evaluateTimeouts(client);

            logger.info(`{{MASS SEND}}: Send Job Progress: Completed target ${global.vars.sendListIndex} out of ${sendList.contacts.length}`);
            const jobPercentComplete = roundToPrecision(global.vars.sendListIndex / sendList.contacts.length * 100, 2);
            logger.info(`{{MASS SEND}}: Send Job Progress: Job is ${jobPercentComplete}% complete.`);
        }

    logger.info("{{MASS SEND}}: Mass send job completed");
}

module.exports = massSend;

async function evaluateTimeouts(client) {

    // TODO: Value for familiar conversation is hard-coded - should be passed to INI
    if (familiarConversationCounter >= 25) {
        familiarConversationCounter = 0;
        deepSleepEveryCounter = 0;
        sleepEveryCounter = 0;
        await familiarStartConversation(client)
    }
    else if (deepSleepEveryCounter >= settings.timeouts.deep_sleep_every){
        deepSleepEveryCounter = 0;
        sleepEveryCounter = 0;

        const randomDeepSleepDuration = percentualVariation(
            settings.timeouts.deep_sleep_duration,
            settings.timeouts.typing_variance
        );
        await new Promise(resolve => {
            logger.info(`{{SLEEP}}: Reached deep sleep target limit (${settings.timeouts.deep_sleep_every}) - ` +
                `Sleeping for ${roundToPrecision(randomDeepSleepDuration, 2)} minutes`);
            setTimeout(resolve, randomDeepSleepDuration * 60 * 1000);
        });
    }
    else if (sleepEveryCounter >= settings.timeouts.sleep_every) {
        sleepEveryCounter = 0;

        const randomSleepDuration = percentualVariation(
            settings.timeouts.sleep_duration,
            settings.timeouts.typing_variance
        );
        await new Promise(resolve => {
            logger.info(`{{SLEEP}}: Reached sleep target limit (${settings.timeouts.sleep_every}) - ` +
                `Sleeping for ${roundToPrecision(randomSleepDuration, 2)} seconds`);
            setTimeout(resolve, randomSleepDuration * 1000);
        });
    }
    else {
        // TODO: Value for familiar conversation is hard-coded - should be passed to INI
        logger.info(`{{SLEEP}}: Current familiar conversation count is ${familiarConversationCounter},` +
            ` up to a max of 25`);
        ++familiarConversationCounter;

        logger.info(`{{SLEEP}}: Current deep sleep count is ${deepSleepEveryCounter},` +
            ` up to a max of ${settings.timeouts.deep_sleep_every}`);
        ++deepSleepEveryCounter;

        logger.info(`{{SLEEP}}: Current short sleep count is ${sleepEveryCounter},` +
            ` up to a max of ${settings.timeouts.sleep_every}`);
        ++sleepEveryCounter;
    }

}
