const fs = require('fs')

class ReportLog {
    /*
        Local variables;
    */
    result = {}; // JSON Object
    info = {}; // Infos Object
    logs = []; // Logs Array Object
    filepath; // File that will be generated

    /**
     * ReportLog constructor
     * @param {string}  filepath     filepath for the JSON file 
     */
    constructor(filepath){
        this.filepath = filepath;
    }

    /**
     * Function to fill local variable (info) with send details.
     * 
     * @param {string}  message     message that was sent to leads
     * @param {array}   files       array with file path that was sent to leads
     * @param {int}     total       amount leads that was sent using sendList
     * @param {int}     success     amount of successful numbers that received the message
     * @param {int}     failed      amount of failed numbers that couldn't receive the message
     */
    setInfo(message, files, total, success, failed) {
        this.info = {
            "data": new Date().toLocaleDateString('pt-br'),
            "total": total,
            "success": success,
            "failed": failed,
            "message": message,
            "files": files
        };
    }

    /**
     * Function to fill local variable (logs) with information of what was sent.
     * 
     * @param {string}  num     phone number from the lead
     * @param {bool}    status  status of message; true if message was sent, false if not.
     * @param {string}  msg     callback message received from venom
     */

    pushLog(num, status, msg) {
        this.logs.push({
            "num": num,
            "status": status,
            "msg": msg
        });
    }

    /**
     * Function to generate the log result, compiling both infos and logs.
     * @returns {string}    JSON Formatted Text
     */

    generate() {
        this.result.infos = this.info;
        this.result.logs = this.logs;
        return JSON.stringify(this.result, null, 2);
    }

    /**
     * Function to create the desired file given in the constructor.
     */

    create(){
        try{
            fs.writeFileSync(this.filepath, this.generate());
        }catch(e){
            console.log(e);
            return false;
        }
    }

}

module.exports = { ReportLog };