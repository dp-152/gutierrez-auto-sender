const venom = require('venom-bot');
const fs = require('fs');
const { argv } = require('yargs');
const {ini_init} = require('./sys/ini');
const path = require('path');
const {logger} = require('./sys/logger');
const { ReportLog } = require('./sys/reportlog');
const inifile = require('./sys/ini');
const {typeTime, loadCampaignFiles, readTextfromFiles, replaceKeys, getDateString} = require('./sys/helper');

/*
    TODO:
        - client.onMessage listener for send list auto removal
 */

// Load settings file passed as --config argument

let settings = ini_init();

logger.info('Initializing server...');

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
        if (message.body === '2'){
            client.sendText(message.from, "Hi there!").catch((err) => { logger.error('Error sending a reply.'); logger.error(err);});
        }
    }));

}

// Mass sender thread
async function massSend(client) {

    logger.info("Initializing Mass Sender Thread...")

    // Load send list passed as --send argument
    const sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'));

    logger.info(`Campaign name is: ${path.dirname(argv.dir)}`);

    // Load timeouts
    const timeouts = {
        typingWPM: parseInt(settings.timeouts.typing),
        typingVariance: parseInt(settings.timeouts.typing_variance),
        betweenFiles: parseInt(settings.timeouts.between_files),
        betweenTargets: parseInt(settings.timeouts.between_targets),
        sleepEvery: parseInt(settings.timeouts.sleep_every),
        sleepDuration: parseInt(settings.timeouts.sleep_duration)
    }

    let targetCounter = 0;

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    logger.info("Probing campaign dir for text files and attachments...")
    const campaignContent = loadCampaignFiles(argv.dir);

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
    var logPath = argv.dir + `/logs/Report_${settings.instance.name}_${logDate}.csv`;
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
                await new Promise(resolve => {
                    logger.info(
                        `Attachment timeout is ${timeouts.betweenFiles} seconds - sleeping`);
                    setTimeout(resolve,
                        timeouts.betweenFiles * 1000);
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

            if (targetCounter < timeouts.sleepEvery){
                ++targetCounter;
                logger.info(`Current target count is ${targetCounter}, up to a max of ${timeouts.sleepEvery}`)
                await new Promise(resolve => {
                    logger.info(
                        `Waiting ${timeouts.betweenTargets} seconds before going to next contact`)
                    setTimeout(resolve, timeouts.betweenTargets * 1000);
                });
            }
            else if (targetCounter === timeouts.sleepEvery){
                targetCounter = 0;
                await new Promise(resolve => {
                    logger.info(`Reached target limit (${timeouts.sleepEvery}) - ` +
                    `Sleeping for ${timeouts.sleepDuration} seconds`);
                    setTimeout(resolve, timeouts.sleepDuration * 1000);
                });
            }

        }

        else {
            logger.info("Invalid or nonexistant contact - skipping");

            /** ReportLog */
            finalReport.pushLog(contact.phone,false);
        }
    }
}