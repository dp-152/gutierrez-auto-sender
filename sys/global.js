const { argv } = require('yargs');
const {ini_init} = require("./ini");
const path = require('path');

// Load required files from CLI arguments
const sendListFile = argv.list;
const settingsFile = argv.config;
const settings = ini_init(settingsFile);
const campaignDir = argv.dir;
const campaignName = path.basename(campaignDir);

module.exports = {
    sendListFile,
    settings,
    campaignDir,
    campaignName,
}

let global = {
    vars: {
        // Setting counter for send list index position
        // Declared in global scope to keep it safe from venom thread destruction
        _sendListIndex: 0,
        get sendListIndex() {
            return this._sendListIndex;
        },
        set sendListIndex(i) {
            this._sendListIndex = i;
        },

        // Setting global scope WhatsApp connected flag
        // Will cause mass sender thread to sleep while false
        _clientIsConnectedFlag: undefined,
        get clientIsConnectedFlag() {
            return this._clientIsConnectedFlag;
        },
        set clientIsConnectedFlag(f) {
            this._clientIsConnectedFlag = f;
        }
    }
}

module.exports = global;
