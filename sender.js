const venom = require('venom-bot');
const fs = require('fs');
const ini = require('ini');
const {argv} = require('yargs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
const { ReportLog } = require('./sys/reportlog');
const {typeTime, loadCampaignFiles, readTextfromFiles, replaceKeys, getDateString} = require('./sys/helper');

/*
    TODO:
        - client.onMessage listener for send list auto removal
 */

// Load settings file passed as --config argument
let settings = ini.parse(fs.readFileSync(argv.config, encoding='utf-8'));

/*
------------------------------------------
--   Logger settings
------------------------------------------
- Usage examples
------------------------------------------
- Using: logger.log('level','message');
- logger.info('message');
- logger.error('message');
------------------------------------------
- Custom format to log file
*/
const lFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} | ${level.toUpperCase()} | ${message}`;
});

const logger = createLogger({
    //levels: winston.config.syslog.levels, // uses predefined levels (syslog)
    format: combine( timestamp({format:'DD/MM/YYYY HH:mm:ss.SSS'}), lFormat), // settings to format logger
    transports: [
      new transports.Console({ level: settings.debug.console_level }), // show in console every error lvl and below
      // Write a file with everything 'info' level and below
      new transports.File({
        filename: 'logs/'+ settings.instance.name + '.log', // filename
        level: settings.debug.file_level // minimum level to start writing into the file
      })
    ]
});

logger.info(`${getDateString(new Date(),"{{year}}/{{month}}/{{day}} - {{hour}}:{{minutes}}")} - Initializing server...`)

logger.info("\n" +
    "#########################################################################\n"+
    "#########################################################################\n"+
    "####    ▗▄ ▄ ▄  ▄▄▄ ▄   ▄▄▄  ▗▄▄▖▗▄▖ ▗▄▖▄▄▄▖                           \n" +
    "####     █▟█▙█  █▄▄ █   █    █ ▐█ █ █ █ █▄▄                           \n" +
    "####     ▐█ █▌  █▄▄ ███ ▜▄▛▘ ▜▙▟▀ █   █ █▄▄▖                           \n" +
    "####                                                          \n" +
    "####    ▄▄▄▖       ▄▄▄▄▄▄▄▄▄▄▄▟▌▀▖     ▗▄▄▖                        \n" +
    "####    ▝▄ ▐▖     ▟▘▐         ▐▌ ▝▙    ▐  ▌ ▄▞▀▀▀▀▀▄▖ ▛▀▄        ▄▘▌\n" +
    "####     ▝▄ ▐▖   ▐▘ ▟▖ ▜▀▀▀▀▀▌▐▖  ▝▚▖  ▐  ▙▞▘▗▞▀▀▀▚▖▝▙▛ ▝▜▖    ▗▀  ▌\n" +
    "####      ▀▖ ▜  ▗▘ ▟█  ▜     ▝▐▌ ▟▖ ▜▖ ▐  █ ▟▘     ▐▖▝█   ▝▙▖▗▞▘   ▌\n" +
    "####       ▜▖ ▜▄▛ ▐▜▝  ▝ ▘▜   ▝▌ ▟▀▖ ▝▙▐  ▌▗▌       ▜ ▙ ▐▙▖ ▀▘ ▗▟▘ ▌\n" +
    "####        ▚▖ ▀ ▗▌▝▜▖ ▜▀▀▀   ▐▌ ▟ ▝▙  ▜  ▙ ▙       ▛ ▙ ▐▌▝▄  ▟▀▐▘ ▌\n" +
    "####         ▚▖ ▗▛  ▐▖ ▜    ▗▛▜▌ ▟   ▚▖   █▖▝▙▖   ▗▛ ▟▛ ▐▖  ▀▞  ▐▖ ▌\n" +
    "####         ▝▚▗▛   ▐   ▘▘▘▘▘ ▐▌ ▟    ▀▄  ▌▝▙▖▝▀▀▀▘▗▞▘▛ ▐▌      ▐  ▌\n" +
    "####          ▝▛    ▝▀▝▘▘▘▘▘▘▀▝▘▘▀     ▝▙ ▌  ▝▀▘▘▀▀▘  ▀▘▀       ▝▀▝▘\n" +
    "####                                     ▚▌\n" +
    "####                                       \n"+
    "#########################################################################\n"+
    "#########################################################################\n")

// Initialize Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)
venom.create(settings.instance.name).then(
    (client) => {
        // Start listener thread
        listener(client).then();

        // Start mass send job
        massSend(client).then(() => logger.log('info',"Mass send job completed"));
    });

// Listener thread
// TODO: Implement device health check (battery, service, connection)
async function listener(client) {
    logger.log('info',`Instance name: ${settings.instance.name}`);
    logger.log('info',"Running listener for account");
    client.onMessage((message => {
        if (message.body === '2'){
            client.sendText(message.from, "Hi there!");
        }
    }));

}

// Mass sender thread
async function massSend(client) {

    logger.info("Initializing Mass Sender Thread...")

    // Load send list passed as --send argument
    let sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'));

    logger.info(`Campaign name is: ${path.dirname(argv.dir).split(path.sep()).pop()}`);

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    logger.info("Probing campaign dir for text files and attachments...")
    let campaignContent = loadCampaignFiles(argv.dir);

    // TODO: Add option to send links with preview
    // TODO: Add option to send contacts
    logger.info("Loading campaing text...")
    let campaignText = readTextfromFiles(campaignContent.text);
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

        let targetCounter = 0;

        // Checks if profile is valid. If not, returns int 404
        let profile = await client.getNumberProfile(targetID);

        if (profile !== 404) {
            logger.info(`Retrieved profile data:    - Account: ${profile.id.user}
                                                            - Is business? ${profile.isBusiness}.
                                                            - Can receive messages? ${profile.canReceiveMessage}.`);

            targetID = profile.id._serialized;

            logger.info(`Target: ${contact.name} - ${profile.id.user}`);
            logger.info("Started sending to contact");

            for (let message of campaignText) {

                message = replaceKeys(message, contact);

                client.startTyping(targetID).then();
                logger.info("Started typing");

                await new Promise(resolve => {
                    let typingTime = typeTime(
                        message.length,
                        settings.timeouts.typing,
                        settings.timeouts.typing_variance
                    );
                    logger.info(`Typing timeout is ${typingTime}ms - sleeping`);
                    setTimeout(resolve, typingTime);
                });

                await client.sendText(targetID, message);
                logger.info(`Typed text: ${message}`);

                client.stopTyping(targetID).then();
                logger.info("Stopped typing");
            }

            for (let attachment of campaignContent.files){
                await new Promise(resolve => {
                    logger.info(
                        `Attachment timeout is ${settings.timeouts.between_files} seconds - sleeping`);
                    setTimeout(resolve,
                        parseInt(settings.timeouts.between_files) * 1000);
                });
                logger.info("Sending attachment:");
                client.sendFile(targetID, attachment, path.basename(attachment));
                logger.info(`Sent ${path.basename(attachment)} as file`);
            }

            logger.info("Finished sending to contact");

            logger.info("Writing data to report log.");
            /** ReportLog
             * @param {string}  targetID    Phone number
             * @param {bool}    status      Sent status
            */
            finalReport.pushLog(contact.phone, true);

            if (targetCounter < parseInt(settings.timeouts.sleep_every)){
                ++targetCounter;
                await new Promise(resolve => {
                    logger.info(
                        `Waiting ${settings.timeouts.between_targets} seconds before going to next contact`)
                    setTimeout(resolve, parseInt(settings.timeouts.between_targets) * 1000);
                });
            }
            else if (targetCounter === parseInt(settings.timeouts.sleep_every)){
                targetCounter = 0;
                await new Promise(resolve => {
                    logger.info(`Reached target limit (${settings.timeouts.sleep_every}) - ` +
                    `Sleeping for ${settings.timeouts.sleep_duration} seconds`);
                    setTimeout(resolve, parseInt(settings.timeouts.sleep_duration) * 1000);
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