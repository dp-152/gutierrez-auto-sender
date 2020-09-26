const { argv } = require('yargs');
const {ini_init} = require("./ini");
const path = require('path');

// Load required files from CLI arguments
const sendListDir = argv.list;
const settingsFile = argv.config;
const settings = ini_init(settingsFile);
const campaignDir = argv.dir;
const campaignName = path.basename(campaignDir);

// Setting counter for send list index position
// Declared in global scope to keep it safe from venom thread destruction
let sendListIndex = 0;

// Setting global scope WhatsApp connected flag
// Will cause mass sender thread to sleep while false
let clientIsConnectedFlag = undefined;

module.exports = {
    sendListDir,
    settings,
    campaignDir,
    campaignName,
    sendListIndex,
    clientIsConnectedFlag
}
