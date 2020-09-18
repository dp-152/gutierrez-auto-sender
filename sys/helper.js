const fs = require('fs');
const path = require('path');
const {logger} = require('./logger');

// Function for setting wait time to simulate human typing
// Returns wait time in milliseconds
function typeTime(textLength, CPM, variance= 10) {
    // Uses percentual variation function to return random CPM value
    const randomCPM = percentualVariation(CPM, variance);
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
    // filter file from dir and ignore them
    let files = fs.readdirSync(dir,{withFileTypes: true}).filter(item => !item.isDirectory()).map(item => item.name);
    
    files.forEach(file => {
        logger.info(`Acquired file: ${file}`);

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

// Replaces known keys within the text with their appropriate equivalents
function replaceKeys(str, object, delimiter = ["{{", "}}"]){

    let regexp = new RegExp(`${delimiter[0]}(.*?)${delimiter[1]}`, 'g');
    let matches = [...str.matchAll(regexp)];

    for (let key of matches) {
        if(key[1] in object){
            str = str.replace(key[0], object[key[1]]);
        }
    }

    return str;
}

// Create string based on date, formatted according to keys string
// Accepted keys - {{year}}, {{month}}, {{day}}, {{hour}}, {{minutes}}, {{seconds}}, {{milliseconds}}
function getDateString(date, formatKeys) {
    const dateObject = {
        year: date.getFullYear(),
        month: `${date.getMonth() + 1}`.padStart(2, '0'),
        day: `${date.getDate()}`.padStart(2, '0'),
        hour: `${date.getHours()}`.padStart(2, '0'),
        minutes: `${date.getMinutes()}`.padStart(2, '0'),
        seconds: `${date.getSeconds()}`.padStart(2, '0'),
        milliseconds: `${date.getMilliseconds()}`.padStart(3, '0')
    }

    return replaceKeys(formatKeys, dateObject);

}

function percentualVariation(baseValue, variance){
    const min = Math.ceil(baseValue - ((baseValue / 100) * variance));
    const max = Math.floor(baseValue + ((baseValue / 100) * variance));
    return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports = {typeTime, loadCampaignFiles, readTextfromFiles, replaceKeys, getDateString}