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
        fs.mkdir(path.dirname(this.filepath), { recursive: true })
            .then(() => {
                logger.info("{{REPORT}}: Created report directory successfully");
                fs.writeFile(this.filepath, (csvColumns))
                    .then(() => {
                        logger.info('{{REPORT}}: Created csv report file successfully');
                        logger.debug(`{{REPORT}}: Written line: ${csvColumns}`);
                    })
                    .catch(err => logger.error(`{{REPORT}}: Error creating report file - ${filepath} - ${err}`));

            })
            .catch(err => logger.error(`{{REPORT}}: Error creating report directory - ${filepath} - ${err}`));

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
        fs.appendFile(this.filepath, (csvData + newLine))
            .then(() => {
                logger.info('{{REPORT}}: Written line to report log file');
                logger.debug(`{{REPORT}}: Line appended to file: ${csvData}`)
            })
            .catch(err => logger.error(`{{REPORT}}: Error writing to report file - ${this.filepath} - ${err} `));
    }
}

module.exports = { ReportLog };