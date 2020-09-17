const fs = require('fs');
const ini = require('ini');
const { argv } = require('yargs');

// default settings
let settings = {};
let settdef = {
    instance: {
      name: 'DefaultInstance'
    },
    timeouts: {
      typing: 400,
      typing_variance: 20,
      between_files: 10,
      between_targets: 15,
      sleep_every: 5,
      sleep_duration: 30
    },
    debug: {
      console_level: 'error',
      file_level: 'info'
    }
};

const ini_init = () => {
  var file;
  try {
    file = fs.readFileSync(argv.config, encoding = 'utf-8');
    settings = ini.parse(file);
    settings = checkParameters(settings);
  } catch (e) {
    console.error('Error trying to fetch data from config file.');
    console.info('Retreiving default parameters');
    settings = settdef;
  }
  return settings;
};

function checkParameters(obj) {
  let skeys = [false, false, false];
  var k = Object.keys(obj);
  var e = Object.entries(obj);
  let result = {};

  k.forEach(function (v, idx) {
    if (v == "instance")
      skeys[0] = true;
    else if (v == "timeouts")
      skeys[1] = true;
    else if (v == "debug")
      skeys[2] = true;
  });

  if (skeys[0]) {
    if (obj.instance.name == undefined)
      result.instance = { name: "DefaultInstance" };
    else
      result.instance = obj.instance;
  } else {
    result.instance = { name: "DefaultInstance" };
  }

  if (skeys[1]) {
    if (obj.timeouts.typing === undefined) {
      result.timeouts = {};
      result.timeouts = { typing: '400' };
    }else{
      result.timeouts = obj.timeouts;
    }

    if (obj.timeouts.typing_variance === undefined)
      result.timeouts.typing_variance = '20';
    else
      result.timeouts.typing_variance = obj.timeouts.typing_variance;

    if (obj.timeouts.between_files === undefined)
      result.timeouts.between_files = '10';
    else
      result.timeouts.between_files = obj.timeouts.between_files;

    if (obj.timeouts.between_targets === undefined)
      result.timeouts.between_targets = '15';
    else
      result.timeouts.between_targets = obj.timeouts.between_targets;

    if (obj.timeouts.sleep_every === undefined)
      result.timeouts.sleep_every = '5';
    else
      result.timeouts.sleep_every = obj.timeouts.sleep_every;

    if (obj.timeouts.sleep_duration === undefined)
      result.timeouts.sleep_duration= '30';
    else
      result.timeouts.sleep_duration = obj.timeouts.sleep_duration;

  } else {
    result.timeouts = {
      typing: '400',
      typing_variance: '20',
      between_files: '10',
      between_targets: '15',
      sleep_every: '5',
      sleep_duration: '30'
    };
  }

  if (skeys[2]) {
    if (obj.debug.console_level === undefined) {
      result.debug = {};
      result.debug.console_level = 'error';
    }else{
      result.debug = obj.debug;
    }
    if (obj.debug.file_level === undefined)
      result.debug.file_level = 'info';
    else
      result.debug.file_level = obj.debug.file_level;

  } else {
    result.debug = {
      console_level: 'error',
      file_level: 'info'
    }
  }

  return result;
}
module.exports = {ini_init, settdef};