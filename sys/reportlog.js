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
        const newLine = "\r\n";
        const csvColumns = ("date,num,status" + newLine);
        // Make the log dir.
        try {
            fs.mkdir(path.dirname(this.filepath), { recursive: true }).then(() => {
                logger.info("Dir created, appending headers.");
                fs.writeFile(this.filepath, (csvColumns)).then(() => {
                    logger.info(`Headers to file ${this.filepath} successful.`);
                });
            });
        } catch (err) {
            logger.error(__filename + " - " + err);
        }
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

        try {
            await fs.appendFile(this.filepath, (csvData + newLine));
            logger.info(`CSV data: ${csvData} appended to file.`);
        } catch (err) {
            logger.error(__filename + " - " + err);
        }

    }

}

module.exports = { ReportLog };