const fs = require('fs').promises;
const path = require('path');
const {ReportLog} = require("../reportlog");
const { logger, report } = require('../logger');
const {
    getDateString,
    loadCampaignFiles,
    percentualVariation,
    readTextFromFiles,
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

// Initializing timeouts object
let timeouts = {};

// Setting counters for sleep and deep sleep routines
let sleepEveryCounter = 0;
let deepSleepEveryCounter = 0;

// Mass sender thread
async function massSend(client) {

    // Load send list passed as --send argument
    const sendList = JSON.parse(await fs.readFile(sendListFile, 'utf-8'));

    logger.info(`{{MASS SEND}}: Campaign name is: ${path.dirname(campaignDir)}`);

    // Load timeouts
    timeouts = {
        typingWPM: parseInt(settings.timeouts.typing),
        typingVariance: parseInt(settings.timeouts.typing_variance),
        betweenFiles: parseInt(settings.timeouts.between_files),
        betweenTargets: parseInt(settings.timeouts.between_targets),
        sleepEvery: parseInt(settings.timeouts.sleep_every),
        sleepDuration: parseInt(settings.timeouts.sleep_duration),
        deepSleepEvery: parseInt(settings.timeouts.deep_sleep_every),
        deepSleepDuration: parseInt(settings.timeouts.deep_sleep_duration)
    }

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    logger.info("{{MASS SEND}}: Probing campaign dir for text files and attachments...")
    const campaignContent = await loadCampaignFiles(campaignDir);
    logger.info(`{{MASS SEND}}: Loaded campaign files: ${JSON.stringify(campaignContent, null, 4)}`)

    // TODO: Add option to send links with preview
    // TODO: Add option to send contacts
    logger.info("{{MASS SEND}}: Loading campaign text...")
    const campaignText = await readTextFromFiles(campaignContent.text);
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
    const logPath = campaignDir + `/logs/Report_${settings.instance.name}_${logDate}.csv`;
    let finalReport = new ReportLog(logPath);

    logger.info("{{MASS SEND}}: Starting mass send job...");

    logger.info(`{{MASS SEND}}: Send list has a total of ${sendList.contacts.length} targets`)
    report.info({ message: "SendListTotalTargets", total: sendList.contacts.length, timestamp: Math.floor(new Date().getTime() / 1000) });

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
                            timeouts.typingWPM,
                            timeouts.typingVariance
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

                report.info({ message: "TypingTime", total: totalTypingTime, number: contact.phone, timestamp: Math.floor(new Date().getTime() / 1000) });

                let totalAttachmentTime = 0;

                for (let attachment of campaignContent.files) {
                    const randomBetweenFiles = percentualVariation(timeouts.betweenFiles, timeouts.typingVariance)
                    await new Promise(resolve => {
                        logger.info(
                            `{{MASS SEND}}: Attachment timeout is ${roundToPrecision(randomBetweenFiles, 2)} seconds - sleeping`);
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

                report.info({ message: "AttachmentTime", total: totalAttachmentTime, number: contact.phone, timestamp: Math.floor(new Date().getTime() / 1000) });

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

            await evaluateTimeouts();

            logger.info(`{{MASS SEND}}: Send Job Progress: Completed target ${global.vars.sendListIndex} out of ${sendList.contacts.length}`);
            const jobPercentComplete = roundToPrecision(global.vars.sendListIndex / sendList.contacts.length * 100, 2);
            logger.info(`{{MASS SEND}}: Send Job Progress: Job is ${jobPercentComplete}% complete.`);
        }

    logger.info("{{MASS SEND}}: Mass send job completed");
}

module.exports = massSend;

async function evaluateTimeouts() {
    if (deepSleepEveryCounter < timeouts.deepSleepEvery) {

        logger.info(`{{SLEEP}}: Current deep sleep count is ${deepSleepEveryCounter},` +
            ` up to a max of ${timeouts.deepSleepEvery}`);
        ++deepSleepEveryCounter;

        if (sleepEveryCounter < timeouts.sleepEvery) {

            logger.info(`{{SLEEP}}: Current short sleep count is ${sleepEveryCounter},` +
                ` up to a max of ${timeouts.sleepEvery}`);
            ++sleepEveryCounter;

            const randomBetweenTargets = percentualVariation(timeouts.betweenTargets, timeouts.typingVariance);
            await new Promise(resolve => {
                logger.info(
                    `{{SLEEP}}: Waiting ${roundToPrecision(randomBetweenTargets, 2)}` +
                    ` seconds before going to next contact`)
                setTimeout(resolve, randomBetweenTargets * 1000);
            });
        } else if (sleepEveryCounter >= timeouts.sleepEvery) {
            sleepEveryCounter = 0;

            const randomSleepDuration = percentualVariation(timeouts.sleepDuration, timeouts.typingVariance);
            await new Promise(resolve => {
                logger.info(`{{SLEEP}}: Reached sleep target limit (${timeouts.sleepEvery}) - ` +
                    `Sleeping for ${roundToPrecision(randomSleepDuration, 2)} seconds`);
                setTimeout(resolve, randomSleepDuration * 1000);
            });
        }
    } else if (deepSleepEveryCounter >= timeouts.deepSleepEvery) {
        deepSleepEveryCounter = 0;
        sleepEveryCounter = 0;

        const randomDeepSleepDuration = percentualVariation(
            timeouts.deepSleepDuration,
            timeouts.typingVariance
        );
        await new Promise(resolve => {
            logger.info(`{{SLEEP}}: Reached deep sleep target limit (${timeouts.deepSleepEvery}) - ` +
                `Sleeping for ${roundToPrecision(randomDeepSleepDuration, 2)} minutes`);
            setTimeout(resolve, randomDeepSleepDuration * 60 * 1000);
        });
    }
}
