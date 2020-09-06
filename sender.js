const venom = require('venom-bot');
const fs = require('fs');
const ini = require('ini');
const {argv} = require('yargs');
const path = require('path');

/*
    TODO:
    - Pass JSON send list to venom client
    - Log sends to file
    - client.onMessage listener for send list auto removal
    - Implement message text
    - Implement file attachments
    - Implement timeouts from config file
    - Create function to count characters and apply settings file CPM parameter as typing length
        - Enable variance for typing speed

 */



let settings = ini.parse(fs.readFileSync(argv.config, encoding='utf-8'))
let sendList = JSON.parse(fs.readFileSync(argv.list, encoding='utf-8'))
let folder = argv.folder
let campaign_text = []
let campaign_files = []

venom.create(settings.instance.name).then((client) => start(client));

function start(client) {
    console.log(`Instance name = ${settings.instance.name}`);
}

function loadCampaignFiles()
{
    // Iterator to folder.
    fs.readdir(folder, (err, files) => {
        files.forEach(file => {
          console.log(file);
          var ext = path.extname(file).substring(1);
          ext == "txt" ? campaign_text.push(file) : campaign_files.push(file);
        });
      });
}