const { argv } = require('yargs');
const {ini_init} = require("./ini");
const path = require('path');

// Load required files from CLI arguments
const sendListFile = argv.list;
const settingsFile = argv.config;
const settings = ini_init;
const campaignDir = argv.dir;
const campaignName = path.basename(campaignDir);

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
        },

        // Save instance name to global scope
        _instanceName: settings.instance.name,
        get instanceName() {
            return this._instanceName;
        },
        set instanceName(n) {
            this._instanceName = n;
        },

        // Saving self destruct flag to prevent a circular dependency issue
        _flagSelfDestruct: false,
        get flagSelfDestruct() {
            return this._flagSelfDestruct;
        },
        set flagSelfDestruct(f) {
            this._flagSelfDestruct = f;
        }
    }
}
module.exports = {
    sendListFile,
    settings,
    settingsFile,
    campaignDir,
    campaignName,
    global
}
