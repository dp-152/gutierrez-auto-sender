const venom = require('venom-bot');
const fs = require('fs');
const ini = require('ini');
const {argv} = require('yargs');
const path = require('path');

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

// Initialize Venom instance - instance name inherited from ini file [instance] name = string
// TODO: Get login status of account
// TODO: Handle login errors (?)
venom.create(settings.instance.name).then(
    (client) => {
        // Start listener thread
        listener(client).then();

        // Start mass send job
        massSend(client).then(() => console.log("Mass send job completed"));
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
     */

    // Load send list passed as --send argument
    let sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'));

    // Enumerate send dir text and attachment files from --dir argument
    // Attachment files will be sent in alphabetical order
    // Rename files before sending? meh
    let sendDir = loadCampaignFiles(argv.dir);
    let campaign_text = [];
    let campaign_files = [];



    // Sleep for 5 seconds after init, before starting send job
    await new Promise(resolve => {
        setTimeout(resolve, 5000);
    });

    console.log("Starting mass send job...");
    // Iterates through contact list from JSON
    for (let contact of sendList.contacts) {

        let targetID = contact.phone + "@c.us";

        // Checks if profile is valid. If not, returns int 404
        let profile = await client.getNumberProfile(targetID);
        console.log("Retrieved profile data:");
        console.log(profile);

        if (profile !== 404){
            targetID = profile.id._serialized;

            // TODO: ISSUE: Will send typing status only sometimes
            client.startTyping(targetID).then();
            console.log("Started typing");

            await new Promise(resolve => {
                let typingTime = typeTime(lipsumText.length, settings.timeouts.typing);
                console.log(`Typing timeout is ${typingTime}`);
                setTimeout(resolve, typingTime);
            });

            await client.sendText(targetID, `${contact.name} - ${lipsumText}`);
            console.log(`Typed text: ${contact.name} - ${lipsumText}`);
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
          console.log(`Acquired file: ${file}`);
          var ext = path.extname(file).substring(1);
          ext == "txt" ? campaign_text.push(file) : campaign_files.push(file);
        });
      });
}

// Reads text from acquired text files array
function readTextfromFiles(textFiles){

    let result = '';
    textFiles.forEach(file => {
        result += FileReader.readAsText(file, 'utf-8');
    });

    return result.split(/[\n\r]/g)
}