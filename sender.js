const { logger } = require('./sys/logger');
const { getDateString } = require('./sys/helper');
const { createVenom } = require('./sys/core/thread-utils');
const {
    settings,
    sendListFile,
    settingsFile,
    campaignDir,
    campaignName,
    global
} = require('./sys/global');

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


// First init of Venom instance - instance name inherited from ini file [instance] name = {string}

createVenom(global.vars.instanceName);
