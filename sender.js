const venom = require('venom-bot');
const fs = require('fs');
const ini = require('ini');
const {argv} = require('yargs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

/*
    TODO:
        - Log sends to file
        - client.onMessage listener for send list auto removal
        - Implement message text ONGOING
        - Implement file attachments ONGOING
        - Implement timeouts from config file
 */

// Load settings file passed as --config argument
let settings = ini.parse(fs.readFileSync(argv.config, encoding='utf-8'));

// Temporary placeholder for text file/content
let lipsumText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."


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
      new transports.Console({ level: settings.debug.console_level }), // show in console every error lvl and below
      // Write a file with everything 'info' level and below
      new transports.File({
        filename: 'logs/'+ settings.instance.name + '.log', // filename
        level: settings.debug.file_level // minimum level to start writing into the file
      })
    ]
});



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
    console.log("Running listener for account");
    logger.info('teste');
    client.onMessage((message => {
        if (message.body === '2'){
            client.sendText(message.from, "Hi there!");
        }
    }));

}

// Mass sender thread
async function massSend(client) {

    /* TODO:
        - Add logger
     */

    // Load send list passed as --send argument
    let sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'));

    // Enumerates send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    // Rename files before sending? meh
    let campaignContent = loadCampaignFiles(argv.dir);

    // TODO: Add key to replace with sendlist info (e.g. [[fullname]] => John D).
    // TODO: Add option to send links with preview
    // TODO: Add option to send contacts
    let campaignText = readTextfromFiles(campaignContent.text);

    // Sleep for 5 seconds after init, before starting send job
    await new Promise(resolve => {
        setTimeout(resolve, 5000);
    });

    console.log("Starting mass send job...");
    // Iterates through contact list from JSON
    for (let contact of sendList.contacts) {
        let targetID = contact.phone + "@c.us";

        let targetCounter = 0;

        // Checks if profile is valid. If not, returns int 404
        let profile = await client.getNumberProfile(targetID);
        console.log("Retrieved profile data:");
        console.log(profile);

        if (profile !== 404) {
            targetID = profile.id._serialized;

            console.log(`Target: ${contact.name} - ${profile.id.user}`);
            console.log("Started sending to contact");

            for (let message of campaignText) {
                // TODO: ISSUE: Will send typing status only sometimes
                client.startTyping(targetID).then();
                console.log("Started typing");

                await new Promise(resolve => {
                    let typingTime = typeTime(
                        message.length,
                        settings.timeouts.typing,
                        settings.timeouts.typing_variance
                    );
                    console.log(`Typing timeout is ${typingTime}ms - sleeping`);
                    setTimeout(resolve, typingTime);
                });

                await client.sendText(targetID, message);
                console.log(`Typed text: ${message}`);

                client.stopTyping(targetID).then();
                console.log("Stopped typing");
            }

            for (let attachment of campaignContent.files){
                await new Promise(resolve => {
                    console.log(`Attachment timeout is ${settings.timeouts.between_files} seconds - sleeping`);
                    setTimeout(resolve,
                        parseInt(settings.timeouts.between_files) * 1000);
                });
                console.log("Sending attachments");
                client.sendFile(targetID, attachment, path.basename(attachment));
                console.log(`Sent ${path.basename(attachment)} as file`);
            }

            console.log("Finished sending to contact");
            if (targetCounter < parseInt(settings.timeouts.sleep_every)){
                ++targetCounter;
                await new Promise(resolve => {
                    console.log(`Waiting ${settings.timeouts.between_targets} before going to next contact`)
                    setTimeout(resolve, parseInt(settings.timeouts.between_targets));
                });
            }
            else if (targetCounter === parseInt(settings.timeouts.sleep_every)){
                targetCounter = 0;
                await new Promise(resolve => {
                    console.log(`Reached target limit (${settings.timeouts.sleep_every}) - 
                    Sleeping for ${settings.timeouts.sleep_duration} seconds`);
                    setTimeout(resolve, parseInt(settings.timeouts.sleep_duration));
                });
            }

        }

        else {
            console.log("Invalid or nonexistant contact - skipping");
        }
    }
}

// Function for setting wait time to simulate human typing
// Returns wait time in milliseconds
function typeTime(textLength, CPM, variance= 10) {
    // Allows for random variance of up to n%
    // TODO: Set variance percentage as ini parameter
    CPM = parseInt(CPM);
    variance = parseInt(variance);
    let minCPM = Math.ceil(CPM - ((CPM / 100) * variance));
    let maxCPM = Math.floor(CPM + ((CPM / 100) * variance));
    let randomCPM = Math.floor(Math.random() * (maxCPM - minCPM + 1) + minCPM);

    // Use CPM to get seconds per character, then multiply by length of text
    let SPC = 60 / randomCPM;
    // Time in seconds * 1000 to get milliseconds
    let totalTime = textLength * SPC * 1000;

    return Math.trunc(totalTime);
}

function loadCampaignFiles(dir){
    // Iterator to folder.
    let text = [];
    let attachments = [];
    let files = fs.readdirSync(dir);

    files.forEach(file => {
        console.log(`Acquired file: ${file}`);

        file = path.resolve(`${dir}\\${file}`);
        let ext = path.extname(file).substring(1);
        ext == "txt" ? text.push(file) : attachments.push(file);
    });

    return {
        "text": text,
        "files": attachments
    }
}

// Reads text from acquired text files array
function readTextfromFiles(textFiles){

    let result = '';
    textFiles.forEach(file => {
        result += fs.readFileSync(file, 'utf-8');
        result += '\n'
    });

    return result.split(/[\r\n]/g).filter((el) => {
        return el !== "";
    });
}