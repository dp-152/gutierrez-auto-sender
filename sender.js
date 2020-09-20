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

const sendListDir = argv.list;
const settingsFile = argv.config;
const settings = ini_init(settingsFile);
const campaignDir = argv.dir;
const campaignName = path.basename(campaignDir);

logger.info('Initializing server...');
logger.info(getDateString(new Date(), `
#############################################################
#
#
#          ********* 🕷 Welcome Venom 🕷 *********
#                    {{year}}/{{month}}/{{day}} -- {{hour}}:{{minutes}}
#
#
#############################################################`));
logger.info("Loading parameters...");

logger.info("Parameters loaded.");
logger.info(`Send list is ${sendListDir}`);
logger.info(`Settings file is ${settingsFile}`);
logger.info("Loaded settings: " + JSON.stringify(settings));
logger.info(`Campaign dir is ${campaignDir}`);
logger.info(`Campaign name is ${campaignName}`);

// Setting counter for send list index position
// Declared in global scope to keep it safe from venom thread destruction
let sendListIndex = 0;

// Setting global scope WhatsApp connected flag
// Will cause mass sender thread to sleep while false
let clientIsConnectedFlag = undefined;

// First init of Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)

// Save instance name to global scope
let globalInstanceName = settings.instance.name;

createVenom(globalInstanceName);

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
    const sendList = JSON.parse(fs.readFileSync(sendListDir, encoding='utf-8'));

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

    logger.info(`Send list has a total of ${sendList.contacts.length} targets`)

    const startingIndex = sendListIndex

    // Iterates through contact list from JSON
    sender_main_loop:
    for (let contact of sendList.contacts.slice(startingIndex)) {
        while (!clientIsConnectedFlag){
            if (client != undefined) {
                logger.warn("Mass sender thread: Client is disconnected but still alive." +
                    " Sleeping for 15 seconds");
                await new Promise(resolve => {setTimeout(resolve, 15 * 1000);});
            }
            else {
                logger.crit(`Mass sender thread: Client has been killed.` +
                    ` Halting mass send at ${sendListIndex} sends`);
                break sender_main_loop;
            }
        }

        ++sendListIndex;
        logger.info(`Send Job Progress: Currently at target ${sendListIndex}`+
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

            for (let attachment of campaignContent.files){
                const randomBetweenFiles = percentualVariation(timeouts.betweenFiles, timeouts.typingVariance)
                await new Promise(resolve => {
                    logger.info(
                        `Attachment timeout is ${randomBetweenFiles} seconds - sleeping`);
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

                const randomDeepSleepDuration = percentualVariation(
                    timeouts.deepSleepDuration,
                    timeouts.typingVariance
                );
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

        logger.info(`Send Job Progress: Sent to target ${sendListIndex} out of ${sendList.contacts.length}`);
        const jobPercentComplete = Math.round(sendListIndex / sendList.contacts.length * 100 * 10) / 10;
        logger.info(`Send Job Progress: Job is ${jobPercentComplete}% complete.`);
    }
}

async function probeAccountHealth(client) {
    logger.info("{{{DEVICE HEALTH PROBE}}}: Waiting 30 seconds before initial probe...");
    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
    let disconnectCount = 0;
    let probeTimeout = 5;

    for (;;) {
        logger.info("{{{DEVICE HEALTH PROBE}}}: Probing account status...");
        const accStatus = await client.getHostDevice().catch(err => {
            logger.error("Error trying to get device status");
            logger.error(err);
        });

        if (accStatus.connected) {
            clientIsConnectedFlag = true;
            disconnectCount = 0;
            probeTimeout = 5;
            logger.info("{{{DEVICE HEALTH PROBE}}}: Device is connected");
            let isPlugged = accStatus.plugged ? " and charging..." : ""
            logger.info(`{{{DEVICE HEALTH PROBE}}}: Battery is at ${accStatus.battery}%${isPlugged}`);
            if (accStatus.battery < 30 && !accStatus.plugged)
                logger.info("{{{DEVICE HEALTH PROBE}}}: Battery is low! please plug the phone to the charger");
            else if (accStatus.battery < 15 && !accStatus.plugged)
                logger.error("{{{DEVICE HEALTH PROBE}}}: BATTERY LEVEL CRITICAL!!!" +
                    " PLUG THE PHONE IMMEDIATELY!");
        }

        else {
            clientIsConnectedFlag = false;
            logger.error("{{{DEVICE HEALTH PROBE}}}: Device is disconnected!!" +
                " Please check device status manually!");
            if (disconnectCount < 5) {
                ++disconnectCount;
                probeTimeout = 1;
            }
            else {
                logger.error("{{{DEVICE HEALTH PROBE}}}: DEVICE HAS BEEN OFFLINE FOR MORE THAN 5 PROBES!!!");
                logger.warn("{{{DEVICE HEALTH PROBE}}}: WILL INITIATE SELF-DESTRUCT SEQUENCE");
                await destroyVenom(client)
                    .then(success => {
                        logger.warn("{{{DEVICE HEALTH PROBE}}}: THREAD DESTROYED!");
                        logger.warn("{{{DEVICE HEALTH PROBE}}}: Waiting for user input to start new thread...");
                        restartVenom();
                    })
                    .catch(err => {
                        logger.error("Error trying to destroy Venom thread");
                    });
                break;
            }
        }

        logger.info(`{{{DEVICE HEALTH PROBE}}}: Will probe account status again in ${probeTimeout}`+
            ` minute${probeTimeout != 1 ? "s" : ""}`);

        await new Promise( resolve => {setTimeout(resolve, probeTimeout * 60 * 1000);})
            .catch(err => {
            logger.error("Error sending timeout for health probe");
            logger.error(err);
        });
    }

}

function createVenom(instanceName) {

    clientIsConnectedFlag = true;

    venom.create(instanceName).then(
        (client) => {
            // Start listener thread
            listener(client).then()
                .catch((err) => {
                    logger.error('Error trying to start a listener thread.');
                    logger.error(err);
                });

            // Start mass send job
            massSend(client)
                .then(() => logger.log('info',"Mass send job completed"))
                .catch((err) => {
                    logger.error('Error trying to start a Mass Send Job.');
                    logger.error(err);
                });

            probeAccountHealth(client).catch(err => {
                logger.error("Error trying to send probe thread");
                logger.error(err);
            });

        }).catch((err) => {
        logger.error('Error trying to start a Venom Instance.');
        logger.error(err);
    });
}

async function destroyVenom(client) {
    logger.warn("Destroy sequence has been initiated.");
    logger.warn(`Current instance is ${globalInstanceName}`);
    logger.warn(`Current campaign is ${campaignName}`);
    logger.warn(`Current send list is ${sendListDir}`);
    logger.warn(`Current sendList index is ${sendListIndex}`);
    logger.warn(`Will now close instance ${globalInstanceName} - session ID: ${client.page._client._sessionId}`);
    await client.close()
        .then(success => {
            logger.info(`Closed thread ${globalInstanceName} successfully - ${success}`);
        })
        .catch(error => {
            logger.error("FUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCK");
            logger.error(error);
        });
}

async function restartVenom() {
    logger.warn("Sleeping for 30 seconds before starting a new Venom instance");
    await new Promise(resolve => {setTimeout(resolve, 30 * 1000);}).catch(err => process.abort(err));
    console.log("Press any key to continue...");
    process.stdin.once('data', () => {
        globalInstanceName = `temp_${Date.now().toString(16)}`;
        createVenom(globalInstanceName);
    });
}
