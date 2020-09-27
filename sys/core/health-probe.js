const { logger } = require('../logger');
const { global } = require('../global');

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
            global.vars.clientIsConnectedFlag = true;
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
            global.vars.clientIsConnectedFlag = false;
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
            ` minute${probeTimeout !== 1 ? "s" : ""}`);

        await new Promise(resolve => { setTimeout(resolve, probeTimeout * 60 * 1000); })
            .catch(err => {
                logger.error("Error sending timeout for health probe");
                logger.error(err);
            });
    }

}

module.exports = probeAccountHealth;
