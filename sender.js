const venom = require('venom-bot');
const fs = require('fs');
const { argv } = require('yargs');
const { ini_init } = require('./sys/ini');
const path = require('path');
const { logger, report } = require('./sys/logger');
const { ReportLog } = require('./sys/reportlog');
const inifile = require('./sys/ini');
const {
    typeTime,
    loadCampaignFiles,
    readTextfromFiles,
    replaceKeys,
    getDateString,
    percentualVariation,
    roundToPrecision
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
logger.info(`Instance name is ${settings.instance.name}`);
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
    logger.info("Running listener for account");
    client.onMessage((message => {

        // TODO: Add option to use regex match instead of string match
        if (message.body === settings.relay.match && !message.from.includes('@g.us')) {
            client.sendText(
                    settings.relay.number + "@c.us",
                    replaceKeys(
                        settings.relay.relay_message_format, {
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
        } else {
            client.sendText(message.from, settings.relay.reply_default);
        }
    }));

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
        } else {
            clientIsConnectedFlag = false;
            logger.error("{{{DEVICE HEALTH PROBE}}}: Device is disconnected!!" +
                " Please check device status manually!");
            if (disconnectCount < 5) {
                ++disconnectCount;
                probeTimeout = 1;
            } else {
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

        logger.info(`{{{DEVICE HEALTH PROBE}}}: Will probe account status again in ${probeTimeout}` +
            ` minute${probeTimeout != 1 ? "s" : ""}`);

        await new Promise(resolve => { setTimeout(resolve, probeTimeout * 60 * 1000); })
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
            if (settings.relay.enabled)
                listener(client).then()
                .catch((err) => {
                    logger.error('Error trying to start a listener thread.');
                    logger.error(err);
                });

            // Start mass send job
            massSend(client)
                .then(() => logger.info("Mass send job completed"))
                .catch((err) => {
                    logger.error('Error trying to start a Mass Send Job.');
                    logger.error(err);
                });

            probeAccountHealth(client)
                .catch(err => {
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
    await new Promise(resolve => { setTimeout(resolve, 30 * 1000); }).catch(err => process.abort(err));
    console.log("Press any key to continue...");
    process.stdin.once('data', () => {
        globalInstanceName = `temp_${Date.now().toString(16)}`;
        createVenom(globalInstanceName);
    });
}