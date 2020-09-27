const venom = require('venom-bot');
const { logger } = require('./sys/logger');
const {
    getDateString,
    replaceKeys,
} = require('./sys/helper');
const {
    settings,
    sendListFile,
    settingsFile,
    campaignDir,
    campaignName,
    global
} = require('./sys/global');
const massSend = require('./sys/core/mass-sender');
const listener = require('./sys/core/listener');

/*
    TODO:
        - client.onMessage listener for send list auto removal
 */

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
logger.info(`Send list is ${sendListFile}`);
logger.info(`Settings file is ${settingsFile}`);
logger.info("Loaded settings: " + JSON.stringify(settings));
logger.info(`Campaign dir is ${campaignDir}`);
logger.info(`Campaign name is ${campaignName}`);


// First init of Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)

createVenom(global.vars.instanceName);

function createVenom(instanceName) {

    global.vars.clientIsConnectedFlag = true;

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
    logger.warn(`Current instance is ${global.vars.instanceName}`);
    logger.warn(`Current campaign is ${campaignName}`);
    logger.warn(`Current send list is ${sendListDir}`);
    logger.warn(`Current sendList index is ${sendListIndex}`);
    logger.warn(`Will now close instance ${global.vars.instanceName} - session ID: ${client.page._client._sessionId}`);
    await client.close()
        .then(success => {
            logger.info(`Closed thread ${global.vars.instanceName} successfully - ${success}`);
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
        global.vars.instanceName = `temp_${Date.now().toString(16)}`;
        createVenom(global.vars.instanceName);
    });
}