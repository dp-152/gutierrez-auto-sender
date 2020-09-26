const fs = require('fs');
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

// Mass sender thread
async function massSend(client) {

    logger.info("Initializing Mass Sender Thread...")

    // Load send list passed as --send argument
    const sendList = JSON.parse(fs.readFileSync(sendListFile, encoding = 'utf-8'));

    logger.info(`Campaign name is: ${path.dirname(campaignDir)}`);

    // Load timeouts
    const timeouts = {
        typingWPM: parseInt(settings.timeouts.typing),
        typingVariance: parseInt(settings.timeouts.typing_variance),
        betweenFiles: parseInt(settings.timeouts.between_files),
        betweenTargets: parseInt(settings.timeouts.between_targets),
        sleepEvery: parseInt(settings.timeouts.sleep_every),
        sleepDuration: parseInt(settings.timeouts.sleep_duration),
        deepSleepEvery: parseInt(settings.timeouts.deep_sleep_every),
        deepSleepDuration: parseInt(settings.timeouts.deep_sleep_duration)
    }

    // Setting counters for sleep and deep sleep routines
    let sleepEveryCounter = 0;
    let deepSleepEveryCounter = 0;

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    logger.info("Probing campaign dir for text files and attachments...")
    const campaignContent = loadCampaignFiles(campaignDir);

    // TODO: Add option to send links with preview
    // TODO: Add option to send contacts
    logger.info("Loading campaign text...")
    const campaignText = readTextFromFiles(campaignContent.text);
    logger.info("Text loaded")

    // Sleep for 5 seconds after init, before starting send job
    logger.info("Sleeping for 5 seconds after init...")
    await new Promise(resolve => {
        setTimeout(resolve, 5000);
    });

    // Campaign Report Log ;
    logger.info("Opening report log file")
    let logDate = getDateString(
        new Date(),
        "{{year}}-{{month}}-{{day}}_{{hour}}-{{minutes}}-{{seconds}}.{{milliseconds}}");
    var logPath = campaignDir + `/logs/Report_${settings.instance.name}_${logDate}.csv`;
    let finalReport = new ReportLog(logPath);

    logger.info("Starting mass send job...");

    logger.info(`Send list has a total of ${sendList.contacts.length} targets`)
    report.info({ message: "SendListTotalTargets", total: sendList.contacts.length, timestamp: Math.floor(new Date().getTime() / 1000) });

    const startingIndex = global.vars.sendListIndex

    // Iterates through contact list from JSON
    sender_main_loop:
        for (let contact of sendList.contacts.slice(startingIndex)) {
            while (!global.vars.clientIsConnectedFlag) {
                if (client != undefined) {
                    logger.warn("Mass sender thread: Client is disconnected but still alive." +
                        " Sleeping for 15 seconds");
                    await new Promise(resolve => { setTimeout(resolve, 15 * 1000); });
                } else {
                    logger.crit(`Mass sender thread: Client has been killed.` +
                        ` Halting mass send at ${global.vars.sendListIndex} sends`);
                    break sender_main_loop;
                }
            }

            ++global.vars.sendListIndex;
            logger.info(`Send Job Progress: Currently at target ${global.vars.sendListIndex}` +
                ` out of ${sendList.contacts.length}`);

            let targetID = contact.phone + "@c.us";

            // Checks if profile is valid. If not, returns int 404
            let profile = await client.getNumberProfile(targetID)
                .catch((err) => {
                    logger.error('Error getting profile number.');
                    logger.error(err);
                });

            if (profile !== 404) {
                logger.info(`Retrieved profile data:    - Account: ${profile.id.user}
                                                            - Is business? ${profile.isBusiness}.
                                                            - Can receive messages? ${profile.canReceiveMessage}.`);

                targetID = profile.id._serialized;

                logger.info(`Target: ${contact.name} - ${profile.id.user}`);
                logger.info("Started sending to contact");

                let totalTypingTime = 0;

                for (let message of campaignText) {

                    message = replaceKeys(message, contact);

                    client.startTyping(targetID).then()
                        .catch((err) => {
                            logger.error('Error trying to start typing.');
                            logger.error(err);
                        });
                    logger.info("Started typing");

                    await new Promise(resolve => {
                        let typingTime = typeTime(
                            message.length,
                            timeouts.typingWPM,
                            timeouts.typingVariance
                        );
                        totalTypingTime += typingTime;
                        logger.info(`Typing timeout is ${typingTime}ms - sleeping`);
                        setTimeout(resolve, typingTime);
                    });

                    await client.sendText(targetID, message)
                        .catch((err) => {
                            logger.error('Error sending message.');
                            logger.error(err);
                        });
                    logger.info(`Typed text: ${message}`);

                    client.stopTyping(targetID).then()
                        .catch((err) => {
                            logger.error('Error trying to stop typing.');
                            logger.error(err);
                        });
                    logger.info("Stopped typing");
                }

                report.info({ message: "TypingTime", total: totalTypingTime, number: contact.phone, timestamp: Math.floor(new Date().getTime() / 1000) });

                let totalAttachmentTime = 0;

                for (let attachment of campaignContent.files) {
                    const randomBetweenFiles = percentualVariation(timeouts.betweenFiles, timeouts.typingVariance)
                    await new Promise(resolve => {
                        logger.info(
                            `Attachment timeout is ${roundToPrecision(randomBetweenFiles, 2)} seconds - sleeping`);
                        setTimeout(resolve,
                            randomBetweenFiles * 1000);
                    });
                    logger.info("Sending attachment:");
                    client.sendFile(targetID, attachment, path.basename(attachment))
                        .catch((err) => {
                            logger.error('Error trying to send file.');
                            logger.error(err);
                        });
                    logger.info(`Sent ${path.basename(attachment)} as file`);

                    totalAttachmentTime += Math.floor(randomBetweenFiles * 1000);
                }

                report.info({ message: "AttachmentTime", total: totalAttachmentTime, number: contact.phone, timestamp: Math.floor(new Date().getTime() / 1000) });

                logger.info("Finished sending to contact");

                logger.info("Writing data to report log.");
                /** ReportLog
                 * @param {string}  targetID    Phone number
                 * @param {boolean}    status      Sent status
                 */
                finalReport.pushLog(contact.phone, true);

                if (deepSleepEveryCounter < timeouts.deepSleepEvery) {
                    ++deepSleepEveryCounter;
                    logger.info(`Current deep sleep count is ${deepSleepEveryCounter},` +
                        ` up to a max of ${timeouts.deepSleepEvery}`);

                    if (sleepEveryCounter < timeouts.sleepEvery) {
                        ++sleepEveryCounter;
                        logger.info(`Current sleep count is ${sleepEveryCounter},` +
                            ` up to a max of ${timeouts.sleepEvery}`);

                        const randomBetweenTargets = percentualVariation(timeouts.betweenTargets, timeouts.typingVariance);
                        await new Promise(resolve => {
                            logger.info(
                                `Waiting ${roundToPrecision(randomBetweenTargets, 2)} seconds before going to next contact`)
                            setTimeout(resolve, randomBetweenTargets * 1000);
                        });
                    } else if (sleepEveryCounter === timeouts.sleepEvery) {
                        sleepEveryCounter = 0;

                        const randomSleepDuration = percentualVariation(timeouts.sleepDuration, timeouts.typingVariance);
                        await new Promise(resolve => {
                            logger.info(`Reached sleep target limit (${timeouts.sleepEvery}) - ` +
                                `Sleeping for ${roundToPrecision(randomSleepDuration, 2)} seconds`);
                            setTimeout(resolve, randomSleepDuration * 1000);
                        });
                    }
                } else if (deepSleepEveryCounter === timeouts.deepSleepEvery) {
                    deepSleepEveryCounter = 0;
                    sleepEveryCounter = 0;

                    const randomDeepSleepDuration = percentualVariation(
                        timeouts.deepSleepDuration,
                        timeouts.typingVariance
                    );
                    await new Promise(resolve => {
                        logger.info(`Reached deep sleep target limit (${timeouts.deepSleepEvery}) - ` +
                            `Sleeping for ${roundToPrecision(randomDeepSleepDuration, 2)} minutes`);
                        setTimeout(resolve, randomDeepSleepDuration * 60 * 1000);
                    });
                }

            } else {
                // TODO: Push to DB when contact is invalid
                logger.info(`${contact.name} ${contact.phone} - Invalid or nonexistant contact - skipping`);
                report.info({ message: "Invalid or nonexistant contact - skipping", number: contact.phone, status: false, timestamp: Math.floor(new Date().getTime() / 1000) });

                /** ReportLog */
                finalReport.pushLog(contact.phone, false);
            }

            logger.info(`Send Job Progress: Sent to target ${global.vars.sendListIndex} out of ${sendList.contacts.length}`);
            const jobPercentComplete = roundToPrecision(global.vars.sendListIndex / sendList.contacts.length * 100, 2);
            logger.info(`Send Job Progress: Job is ${jobPercentComplete}% complete.`);
        }
}
