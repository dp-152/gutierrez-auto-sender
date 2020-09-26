const fs = require('fs');
const { ini_init } = require('./ini');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf, prettyPrint } = format;

let settings = ini_init();

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
    format: combine(timestamp({ format: 'DD/MM/YYYY HH:mm:ss.SSS' }), lFormat), // settings to format logger
    transports: [
        new transports.Console({ level: settings.debug.console_level }), // show in console every error lvl and below
        // Write a file with everything 'info' level and below
        new transports.File({
            filename: 'logs/' + settings.instance.name + '.log', // filename
            level: settings.debug.file_level // minimum level to start writing into the file
        })
    ]
});

const report = createLogger({
    format: format.json(),
    transports: [new transports.File({
        filename: 'logs/' + settings.instance.name + '_report.json', // filename
        level: 'info' // minimum level to start writing into the file
    })]
});

module.exports = { logger, report };