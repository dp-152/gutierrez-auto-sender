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

logger.info('{{INIT}}: Initializing server...');
logger.info(getDateString(new Date(), `
#############################################################
#
#
#          ********* 🕷 Welcome Venom 🕷 *********
#                    {{year}}/{{month}}/{{day}} -- {{hour}}:{{minutes}}
#
#
#############################################################`));
logger.info("{{INIT}}: Loading parameters...");

logger.info("{{INIT}}: Parameters loaded.");
logger.info(`{{INIT}}: Instance name is ${settings.instance.name}`);
logger.info(`{{INIT}}: Send list is ${sendListFile}`);
logger.info(`{{INIT}}: Settings file is ${settingsFile}`);
logger.info(`{{INIT}}: Loaded settings: ${JSON.stringify(settings, null, 4)}`);
logger.info(`{{INIT}}: Campaign dir is ${campaignDir}`);
logger.info(`{{INIT}}: Campaign name is ${campaignName}`);


// First init of Venom instance - instance name inherited from ini file [instance] name = {string}
logger.info("{{INIT}}: Creating Venom instance...");
createVenom(global.vars.instanceName);
