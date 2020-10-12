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

    venom.create(instanceName).then(
        (client) => {
            global.vars.clientIsConnectedFlag = true;

            // Start listener thread{
            listener(client)
                .catch((err) => {
                    logger.error('{{INIT}}: Error trying to start a listener thread.');
                    logger.error(err);
                });

            // Start mass send job
            logger.info("{{INIT}}: Initializing Mass Sender Thread...")
            massSend(client)
                .catch((err) => {
                    logger.error('{{INIT}}: Error trying to start a Mass Send Job.');
                    logger.error(err);
                });

            probeAccountHealth(client)
                .catch(err => {
                    logger.error("{{INIT}}: Error trying to send probe thread");
                    logger.error(err);
                });

            checkSelfDestructState(client)
                .catch(err => {
                    logger.error( "{{INIT}}: Error trying to dispatch self-destruct checker");
                    logger.error(err);
                });

        }).catch((err) => {
        logger.error('{{INIT}}: Error trying to start a Venom Instance.');
        logger.error(err);
    });
}

async function destroyVenom(client) {
    global.vars.flagSelfDestruct = false;
    logger.warn("{{SELF-DESTRUCT}}: Self destruct sequence has been initiated.");
    logger.warn(`{{SELF-DESTRUCT}}: Current instance is ${global.vars.instanceName}`);
    logger.warn(`{{SELF-DESTRUCT}}: Current campaign is ${campaignName}`);
    logger.warn(`{{SELF-DESTRUCT}}: Current send list is ${sendListFile}`);
    logger.warn(`{{SELF-DESTRUCT}}: Current sendList index is ${global.vars.sendListIndex}`);
    logger.warn(`{{SELF-DESTRUCT}}: Will now close instance ${global.vars.instanceName}` +
        ` with session ID: ${client.page._client._sessionId}`);
    await client.close()
        .then(() => {
            logger.info(`{{SELF-DESTRUCT}}: Closed thread ${global.vars.instanceName} successfully`);
        })
        .catch(error => {
            logger.error("{{SELF-DESTRUCT}}: FUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCKFUCK");
            logger.error(error);
        });
}

async function restartVenom() {
    logger.warn("{{SELF-DESTRUCT}}: Sleeping for 30 seconds before starting a new Venom instance");
    await new Promise(resolve => { setTimeout(resolve, 30 * 1000); }).catch( () => process.abort());
    logger.warn("{{SELF-DESTRUCT}}: Waiting for user input to start new thread...");
    console.log("Press any key to continue...");
    process.stdin.once('data', () => {
        global.vars.instanceName = `temp_${Date.now().toString(16)}`;
        createVenom(global.vars.instanceName);
    });
}

async function checkSelfDestructState(client) {
    // TODO: Maybe use a callback instead of an infinite loop with timeout?
    for (;;) {
        if (global.vars.flagSelfDestruct) {
            await selfDestruct(client);
            break;
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}

async function selfDestruct(client) {
    logger.error("{{SELF-DESTRUCT}}: DEVICE HAS BEEN OFFLINE FOR MORE THAN 5 PROBES!!!");
    logger.warn("{{SELF-DESTRUCT}}: WILL INITIATE SELF-DESTRUCT SEQUENCE");
    await destroyVenom(client)
        .then(success => {
            logger.warn("{{SELF-DESTRUCT}}: THREAD DESTROYED!");
            restartVenom();
        })
        .catch(err => {
            logger.error("{{SELF-DESTRUCT}}: Error trying to destroy Venom thread");
        });
}

module.exports = {
    createVenom
}