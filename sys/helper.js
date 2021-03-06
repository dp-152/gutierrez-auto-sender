const fs = require('fs').promises;
const path = require('path');

let lipsumWordList;

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

async function loadFilesInDir(dir) {
    // Iterator to folder.
    let text = [];
    let attachments = [];
    // filter file from dir and ignore them
    let files = await fs.readdir(dir,{withFileTypes: true});
        //.filter(item => !item.isDirectory()).map(item => item.name);
    
    files.filter(item => !item.isDirectory()).map(item => item.name).forEach(file => {
        file = path.resolve(`${dir}\\${file}`);
        let ext = path.extname(file).substring(1);
        ext === "txt" ? text.push(file) : attachments.push(file);
    });

    return {
        "text": text,
        "files": attachments
    }
}

// Reads text from acquired text files array
async function readTextFiles(textFiles) {

    let result = '';
    for (let file of textFiles){
        result += await fs.readFile(file, 'utf-8');
        result += '\n'
    }

    return result.split(/[\r\n]/g).filter((el) => {
        return el !== "";
    });
}

// Replaces known keys within the text with their appropriate equivalents
function replaceKeys(str, object, delimiter = ["{{", "}}"]) {

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

// Generates a random number between a percentual variation threshold (above and below) the base value
// Takes an int as base value and an int corresponding to the percentual variation to be applied
function percentualVariation(baseValue, variance, isInt = false) {

    let min = baseValue - ((baseValue / 100) * variance);
    let max = baseValue + ((baseValue / 100) * variance);

    if (isInt) {
        min = Math.ceil(min);
        max = Math.floor(max);
    }

    let result = randomInRange(min, max, false);

    if (isInt)
        result = Math.floor(result);

    return result;
}

function randomInRange(min, max, isInt = true) {
    if (isInt)
        return Math.floor(Math.random() * (max - min + 1) + min);
    else
        return Math.random() * (max - min) + min;
}

// Rounds a float number to n precision digits
// Use negative precision values to round to tens, hundreds, thousands, et cetera.
function roundToPrecision(value, precision = 0) {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
}

// Parses object string values into ints
// To be used to retrieve numerical values from object generated from ini file
function parseIntsInObj(obj) {
      for (const [key, value] of Object.entries(obj))
          obj[key] = parseInt(value);
      return obj;
}

// Returns suffix if int is different than 1
function pluralSuffix(int, suffix) {
    return int === 1 ? '' : suffix;
}

// Generates a lorem ipsum string of length n (words)
async function makeIpsum(length) {
    // Loads word list from misc/lipsum.txt
    if (!lipsumWordList) {
        lipsumWordList = await (fs.readFile(path.resolve(__dirname, 'misc', 'lipsum.txt'), "utf-8"));
        lipsumWordList = lipsumWordList.split(/[\r\n]/g)
            // Filters out any potential empty strings
            .filter(line => {
                return line !== '';
            });
    }
    let result = "";
    let commaChance = 2;
    for (let i = 0; i < length; ++i) {
        // Pulls a random number between zero and the length of the lipsum array
        const word = lipsumWordList[randomInRange(0, lipsumWordList.length - 1)];
        switch (i) {
            // Capitalize if first word
            case 0:
                result += word.charAt(0).toUpperCase() + word.slice(1) + ' ';
                break;
            // Adds a period to the last word of the string
            case length - 1:
                result += word + '.';
                break;
            // Add a coma at random points (between zero and the max length of the string)
            case randomInRange(i - commaChance, i + commaChance):
                commaChance += 5;
                result += word + ', ';
                break;
            // Adds a simple space to any other word
            default:
                --commaChance;
                result += word + ' ';
        }
    }
    return result;
}

module.exports = {
    typeTime,
    loadFilesInDir,
    readTextFiles,
    replaceKeys,
    getDateString,
    percentualVariation,
    roundToPrecision,
    parseIntsInObj,
    randomInRange,
    makeIpsum,
    pluralSuffix
}
