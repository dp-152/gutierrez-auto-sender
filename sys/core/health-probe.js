const { logger } = require('../logger');
const { global } = require('../global');

async function probeAccountHealth(client) {
    logger.info("{{HEALTH PROBE}}: Waiting 30 seconds before initial probe...");
    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
    let disconnectCount = 0;
    let probeTimeout = 5;

    for (;;) {
        logger.info("{{HEALTH PROBE}}: Probing account status...");
        const accStatus = await client.getHostDevice().catch(err => {
            logger.error("Error trying to get device status");
            logger.error(err);
        });

        if (accStatus.connected) {
            global.vars.clientIsConnectedFlag = true;
            disconnectCount = 0;
            probeTimeout = 5;
            logger.info("{{HEALTH PROBE}}: Device is connected");
            let isPlugged = accStatus.plugged ? " and charging..." : ""
            logger.info(`{{HEALTH PROBE}}: Battery is at ${accStatus.battery}%${isPlugged}`);
            if (accStatus.battery < 30 && !accStatus.plugged)
                logger.info("{{HEALTH PROBE}}: Battery is low! please plug the phone to the charger");
            else if (accStatus.battery < 15 && !accStatus.plugged)
                logger.error("{{HEALTH PROBE}}: BATTERY LEVEL CRITICAL!!!" +
                    " PLUG THE PHONE IMMEDIATELY!");
        } else {
            global.vars.clientIsConnectedFlag = false;
            logger.error("{{HEALTH PROBE}}: Device is disconnected!!" +
                " Please check device status manually!");
            if (disconnectCount < 5) {
                ++disconnectCount;
                probeTimeout = 1;
            } else {
                global.vars.flagSelfDestruct = true;
                break;
            }
        }

        logger.info(`{{HEALTH PROBE}}: Will probe account status again in ${probeTimeout}` +
            ` minute${probeTimeout !== 1 ? "s" : ""}`);

        await new Promise(resolve => { setTimeout(resolve, probeTimeout * 60 * 1000); })
            .catch(err => {
                logger.error("{{HEALTH PROBE}}: Error sending timeout for health probe");
                logger.error(err);
            });
    }

}

module.exports = probeAccountHealth;
