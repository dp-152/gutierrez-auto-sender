const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');
const { getDateString } = require('./helper');

class ReportLog {

    // Local variables;
    filepath; // File that will be generated

    /**
     * ReportLog constructor
     * @param {string}  filepath     filepath for the JSON file 
     */
    constructor(filepath) {
        this.filepath = filepath;
    }

    /**
     * Function to write a CSV log file into the directory given by filepath
     * --------------------------------------
     * @param {string} num  phone number
     * @param {boolean} status sent status
     * --------------------------------------
     * @result {void} if was successful
     * @result {error} if it got any error (it will stop the execution)
     */

    async pushLog(num, status) {

        // combine data into a csv format
        const csvData = [
            getDateString(new Date(), '{{year}}/{{month}}/{{day}}-{{hour}}:{{minutes}}:{{seconds}}'),
            num,
            status
        ].join(",");
        const newLine = "\r\n";

        if (await fs.exists(this.filepath)) {
            // file exists
            // append the data to the file
            try {
                await fs.appendFile(this.filepath, (csvData + newLine));
            } catch (err) {
                logger.error(__filename + " - " + err);
            }
        } else {
            // file doesn't exists
            const csvColumns = ("date,num,status" + newLine);

            // if the log dir doesn't exist, create it.
            if (!await fs.exists(path.dirname(this.filepath))) {
                await fs.mkdir(path.dirname(this.filepath));
            }

            // place header files along with the first data
            try {
                await fs.writeFile(this.filepath, (csvColumns + csvData + newLine));
            } catch (err) {
                logger.error(__filename + " - " + err);
            }
        }

    }

}

module.exports = { ReportLog };