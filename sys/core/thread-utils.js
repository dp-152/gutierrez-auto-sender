const venom = require('venom-bot');
const massSend = require('./mass-sender');
const listener = require('./listener');
const probeAccountHealth = require('./health-probe');
const { logger } = require('../logger');
const {
    settings,
    campaignName,
    sendListFile,
    global
} = require('../global');

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
    logger.warn(`Current send list is ${sendListFile}`);
    logger.warn(`Current sendList index is ${global.vars.sendListIndex}`);
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
    await new Promise(resolve => { setTimeout(resolve, 30 * 1000); }).catch( () => process.abort());
    console.log("Press any key to continue...");
    process.stdin.once('data', () => {
        global.vars.instanceName = `temp_${Date.now().toString(16)}`;
        createVenom(global.vars.instanceName);
    });
}

module.exports = {
    createVenom,
    destroyVenom,
    restartVenom
}