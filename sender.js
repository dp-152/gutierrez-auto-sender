const venom = require('venom-bot');
const fs = require('fs');
const ini = require('ini');
const {argv} = require('yargs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

/*
------------------------------------------
--   Logger settings
------------------------------------------
- Usage examples
------------------------------------------
- Using: logger.log('level','message');
- logger.info('message');
- logger.error('message');
------------------------------------------
- Custom format to log file
*/
const lFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} | ${level.toUpperCase()} | ${message}`;
});

const logger = createLogger({
    //levels: winston.config.syslog.levels, // uses predefined levels (syslog)
    format: combine( timestamp({format:'DD/MM/YYYY HH:mm:ss.SSS'}), lFormat), // settings to format logger
    transports: [
      new transports.Console({ level: 'error' }), // show in console every error lvl and below
      // Write a file with everything 'info' level and below
      new transports.File({
        filename: 'app.log', // filename
        level: 'info' // minimum level to start writing into the file
      })
    ]
});

/*
    TODO:
        - Pass JSON send list to venom client DONE
        - Log sends to file
        - client.onMessage listener for send list auto removal
        - Implement message text ONGOING
        - Implement file attachments ONGOING
        - Implement timeouts from config file
        - Create function to count characters and apply settings file CPM parameter as typing length
            - Enable variance for typing speed
 */

// Load settings file passed as --config argument
let settings = ini.parse(fs.readFileSync(argv.config, encoding='utf-8'));

// Load send list passed as --send argument
let sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'));

// Enumerate send dir text and attachment files from --dir argument
// Attachment files will be sent in alphabetical order
// Rename files before sending? meh
let sendDir = loadCampaignFiles(argv.dir)
let campaign_text = []
let campaign_files = []

// Temporary placeholder for text file/content
let lipsumText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."

// Initialize Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)
venom.create(settings.instance.name).then(
    (client) => {
        // Start listener thread
        listener(client).then();

        // Start mass send job
        //massSend(client).then(() => console.log("Mass send job completed"));
    });

// Listener thread
// TODO: Implement device health check (battery, service, connection)
async function listener(client) {
    console.log(`Instance name: ${settings.instance.name}`);
    client.onMessage((message => {
        if (message.body === '2'){
            client.sendText(message.from, "Hi there!");
        }
    }));

}

// Mass sender thread
async function massSend(client) {

    /* TODO:
        - Maybe split text lines?
        - Account for attachments
        - Add logger
        - Prevent wasting typing time when account is invalid
     */

    // Sleep for 5 seconds after init, before starting send job
    await new Promise(resolve => {
        setTimeout(resolve, 5000);
    })

    console.log("Starting mass send job...");
    // Iterates through contact list from JSON
    for (let contact of sendList.contacts) {
        // TODO: Account for extra '9' digit - DONE? (profile.id._serialized returns formatted number)
        // Database may contain numbers either with or without the extra digit
        // Must account for both cases
        let targetID = contact.phone + "@c.us";

        // Checks if profile is valid. If not, returns int 404
        let profile = await client.getNumberProfile(targetID);
        console.log("Retrieved profile data:");
        console.log(profile);

        if (profile !== 404){
            targetID = profile.id._serialized;

            // TODO: ISSUE: Sends typing status only sometimes
            client.startTyping(targetID).then();
            console.log("Started typing");
            await new Promise(resolve => {
                let typingTime =typeTime(lipsumText.length, settings.timeouts.typing);
                console.log(`Typing timeout is ${typingTime}`);
                setTimeout(resolve, typingTime);
            });
            await client.sendText(targetID, contact.name + " - " + lipsumText);
            console.log(contact.name + " - " + lipsumText);
            client.stopTyping(targetID).then();
            console.log("Stopped typing");


        }
    }
}

// Function for setting wait time to simulate human typing
// Returns wait time in milliseconds
function typeTime(textLength, CPM) {
    // Allows for random variance of up to n%
    // TODO: Set variance percentage as ini parameter
    CPM = parseInt(CPM);
    let minCPM = Math.ceil(CPM - ((CPM / 100) * 20));
    let maxCPM = Math.floor(CPM + ((CPM / 100) * 20));
    let randomCPM = Math.floor(Math.random() * (maxCPM - minCPM + 1) + minCPM);

    // Use CPM to get seconds per character, then multiply by length of text
    let SPC = 60 / randomCPM;
    // Time in seconds * 1000 to get milliseconds
    let totalTime = textLength * SPC * 1000;

    return Math.trunc(totalTime);
}

function loadCampaignFiles(dir){
    // Iterator to folder.
    fs.readdir(dir, (err, files) => {
        files.forEach(file => {
          console.log(file);
          var ext = path.extname(file).substring(1);
          ext == "txt" ? campaign_text.push(file) : campaign_files.push(file);
        });
      });
}