const fs = require('fs')
const path = require('path')
const {logger} = require('./logger');

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

    pushLog(num, status) {

        // combine data into a csv format
        var csvdata = [num, status].join(",");
        var newline = "\r\n";

        if (fs.existsSync(this.filepath)) {
            // file exists
            // append the data to the file
            try {
                fs.appendFileSync(this.filepath, (csvdata + newline));
            } catch (err) {
                logger.error(__filename + " - " + err);
            }
        } else {
            // file doesn't exists
            var csvcolumns = ("num,status" + newline);

            // if the log dir doesn't exist, create it.
            if (!fs.existsSync(path.dirname(this.filepath))) {
                fs.mkdirSync(path.dirname(this.filepath));
            }

            // place header files along with the first data
            try {
                fs.writeFileSync(this.filepath, (csvcolumns + csvdata + newline));
            } catch (err) {
                logger.error(__filename + " - " + err);
            }
        }

    }

}

module.exports = { ReportLog };