const venom = require('venom-bot');
const fs = require('fs');
const { argv } = require('yargs');
const {ini_init} = require('./sys/ini');
const path = require('path');
const {logger} = require('./sys/logger');
const { ReportLog } = require('./sys/reportlog');
const inifile = require('./sys/ini');
const {
    typeTime,
    loadCampaignFiles,
    readTextfromFiles,
    replaceKeys,
    getDateString,
    percentualVariation
} = require('./sys/helper');

/*
    TODO:
        - client.onMessage listener for send list auto removal
 */

// Load required files from CLI arguments

const sendList = argv.list;
const settingsFile = argv.config;
const settings = ini_init(settingsFile);
const campaignDir = argv.dir;
const campaignName = path.basename(campaignDir);

logger.info('Initializing server...');
logger.info(getDateString(new Date(), `
#############################################################
#
#
#          ********* Welcome Venom 🕷 *********
#       {{year}}/{{month}}/{{day}} -- {{hour}}:{{minutes}}
#
#
############################################################# 
`));
logger.info("Loading parameters...");

logger.info("Parameters loaded.");
logger.info(`Send list is ${sendList}`);
logger.info(`Settings file is ${settingsFile}`);
logger.info("Loaded settings: " + settings);
logger.info(`Campaign dir is ${campaignDir}`);
logger.info(`Campaign name is ${campaignName}`);

// Initialize Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)
venom.create(settings.instance.name).then(
    (client) => {
        // Start listener thread
        listener(client).then().catch((err) => { logger.error('Error trying to start a listener thread.'); logger.error(err);});

        // Start mass send job
        massSend(client).then(() => logger.log('info',"Mass send job completed")).catch((err) => { logger.error('Error trying to start a Mass Send Job.'); logger.error(err);});
    }).catch((err) => {
        logger.error('Error trying to start a Venom Instance.');
        logger.error(err);
    });

// Listener thread
// TODO: Implement device health check (battery, service, connection)
async function listener(client) {
    logger.log('info',`Instance name: ${settings.instance.name}`);
    logger.log('info',"Running listener for account");
    client.onMessage((message => {

        // TODO: Add option to use regex match instead of string match
        if (message.body === settings.relay.match && !message.from.includes('@g.us')){
            client.sendText(
                settings.relay.number + "@c.us",
                replaceKeys(
                    settings.relay.relay_message_format,
                    {
                        phone: message.from.toString().replace("@c.us", ""),
                        campaign: campaignName,
                        message: message.body
                    })
                )
                .catch((err) => {
                    logger.error('Error relaying message.');
                    logger.error(err);
                });
            client.sendText(message.from, settings.relay.reply_onmatch)
                .catch((err) => {
                    logger.error('Error sending a reply.');
                    logger.error(err);
                });
        }
        else {
            client.sendText(message.from, settings.relay.reply_default);
        }
    }));

}

// Mass sender thread
async function massSend(client) {

    logger.info("Initializing Mass Sender Thread...")

    // Load send list passed as --send argument
    const sendList = JSON.parse(fs.readFileSync(sendList, encoding='utf-8'));

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
    logger.info("Loading campaing text...")
    const campaignText = readTextfromFiles(campaignContent.text);
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
    // Iterates through contact list from JSON
    for (let contact of sendList.contacts) {
        let targetID = contact.phone + "@c.us";

        // Checks if profile is valid. If not, returns int 404
        let profile = await client.getNumberProfile(targetID).catch((err) => { logger.error('Error getting profile number.'); logger.error(err);});

        if (profile !== 404) {
            logger.info(`Retrieved profile data:    - Account: ${profile.id.user}
                                                            - Is business? ${profile.isBusiness}.
                                                            - Can receive messages? ${profile.canReceiveMessage}.`);

            targetID = profile.id._serialized;

            logger.info(`Target: ${contact.name} - ${profile.id.user}`);
            logger.info("Started sending to contact");

            for (let message of campaignText) {

                message = replaceKeys(message, contact);

                client.startTyping(targetID).then().catch((err) => { logger.error('Error trying to start typing.'); logger.error(err);});
                logger.info("Started typing");

                await new Promise(resolve => {
                    let typingTime = typeTime(
                        message.length,
                        timeouts.typingWPM,
                        timeouts.typingVariance
                    );
                    logger.info(`Typing timeout is ${typingTime}ms - sleeping`);
                    setTimeout(resolve, typingTime);
                });

                await client.sendText(targetID, message).catch((err) => { logger.error('Error sending message.'); logger.error(err);});
                logger.info(`Typed text: ${message}`);

                client.stopTyping(targetID).then().catch((err) => { logger.error('Error trying to stop typing.'); logger.error(err);});
                logger.info("Stopped typing");
            }

            for (let attachment of campaignContent.files){
                const randomBetweenFiles = percentualVariation(timeouts.betweenFiles, timeouts.typingVariance)
                await new Promise(resolve => {
                    logger.info(
                        `Attachment timeout is ${randomBetweenFiles} seconds - sleeping`);
                    setTimeout(resolve,
                        randomBetweenFiles * 1000);
                });
                logger.info("Sending attachment:");
                client.sendFile(targetID, attachment, path.basename(attachment)).catch((err) => { logger.error('Error trying to send file.'); logger.error(err);});
                logger.info(`Sent ${path.basename(attachment)} as file`);
            }

            logger.info("Finished sending to contact");

            logger.info("Writing data to report log.");
            /** ReportLog
             * @param {string}  targetID    Phone number
             * @param {bool}    status      Sent status
            */
            finalReport.pushLog(contact.phone, true);

            if (deepSleepEveryCounter < timeouts.deepSleepEvery){
                ++deepSleepEveryCounter;
                logger.info(`Current deep sleep count is ${deepSleepEveryCounter},` +
                            ` up to a max of ${timeouts.deepSleepEvery}`);

                if (sleepEveryCounter < timeouts.sleepEvery){
                    ++sleepEveryCounter;
                    logger.info(`Current sleep count is ${sleepEveryCounter},` +
                        ` up to a max of ${timeouts.sleepEvery}`);

                    const randomBetweenTargets = percentualVariation(timeouts.betweenTargets, timeouts.typingVariance);
                    await new Promise(resolve => {
                        logger.info(
                            `Waiting ${randomBetweenTargets} seconds before going to next contact`)
                        setTimeout(resolve, randomBetweenTargets * 1000);
                    });
                }
                else if (sleepEveryCounter === timeouts.sleepEvery){
                    sleepEveryCounter = 0;

                    const randomSleepDuration = percentualVariation(timeouts.sleepDuration, timeouts.typingVariance);
                    await new Promise(resolve => {
                        logger.info(`Reached sleep target limit (${timeouts.sleepEvery}) - ` +
                            `Sleeping for ${randomSleepDuration} seconds`);
                        setTimeout(resolve, randomSleepDuration * 1000);
                    });
                }
            }

            else if (deepSleepEveryCounter === timeouts.deepSleepEvery){
                deepSleepEveryCounter = 0;
                sleepEveryCounter = 0;

                const randomDeepSleepDuration = percentualVariation(timeouts.deepSleepDuration, timeouts.typingVariance);
                await new Promise(resolve => {
                    logger.info(`Reached deep sleep target limit (${timeouts.deepSleepEvery}) - ` +
                        `Sleeping for ${randomDeepSleepDuration} minutes`);
                    setTimeout(resolve, randomDeepSleepDuration * 60 * 1000);
                });
            }

        }

        else {
            // TODO: Push to DB when contact is invalid
            logger.info(`${contact.name} ${contact.phone} - Invalid or nonexistant contact - skipping`);

            /** ReportLog */
            finalReport.pushLog(contact.phone,false);
        }
    }
}