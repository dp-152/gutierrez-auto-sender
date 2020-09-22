const fs = require('fs');
const ini = require('ini');
const { argv } = require('yargs');

// default settings
let settings = {};
let settDef = {
    instance: {
      name: 'DefaultInstance'
    },
    timeouts: {
      typing: 400,
      typing_variance: 20,
      between_files: 10,
      between_targets: 15,
      sleep_every: 5,
      sleep_duration: 30,
      deep_sleep_every: 20,
      deep_sleep_duration: 10
    },
    relay: {
      enabled: false,
      number: "5541900000000",
      match: "2",
      reply_onmatch: "Your phone number will be removed. Thanks from Venom 🕷",
      reply_default: "I'm sorry, I didn't catch your message. Please type 2 to be removed from this send list",
      relay_message_format: "From: {{phone}}\nCampaign: {{campaign}}\nMessage: {{message}}"
    },
    debug: {
      console_level: 'info',
      file_level: 'info'
    }
};

const ini_init = (configFile = argv.config) => {
  let file;
  try {
    file = fs.readFileSync(configFile, 'utf-8');
    settings = ini.parse(file);
    settings = checkParameters(settings);
  } catch (e) {
    console.error('Error trying to fetch data from config file.');
    console.error(e);
    console.info('Falling back to default parameters');
    settings = settDef;
  }
  return settings;
};

function checkParameters(obj) {
  let sKeys = [false, false, false, false];
  const k = Object.keys(obj);
  const e = Object.entries(obj);
  let result = {};

  k.forEach(function (v, idx) {
    if (v === "instance")
      sKeys[0] = true;
    else if (v === "timeouts")
      sKeys[1] = true;
    else if (v === "relay")
      sKeys[2] = true;
    else if (v === "debug")
      sKeys[3] = true;
  });

  if (sKeys[0]) {
    if (obj.instance.name === undefined)
      result.instance = { name: "DefaultInstance" };
    else
      result.instance = obj.instance;
  } else {
    result.instance = { name: "DefaultInstance" };
  }

  if (sKeys[1]) {
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

    if (obj.timeouts.deep_sleep_duration === undefined)
      result.timeouts.deep_sleep_duration = '10';
    else
      result.timeouts.deep_sleep_duration = obj.timeouts.deep_sleep_duration

    if (obj.timeouts.deep_sleep_every === undefined)
      result.timeouts.deep_sleep_every = '20';
    else
      result.timeouts.deep_sleep_every = obj.timeouts.deep_sleep_every

  } else {
    result.timeouts = {
      typing: '400',
      typing_variance: '20',
      between_files: '10',
      between_targets: '15',
      sleep_every: '5',
      sleep_duration: '30',
      deep_sleep_every: '20',
      deep_sleep_duration: '10',
    };
  }

  if (sKeys[2]) {
    if (obj.relay.enabled === undefined) {
      result.relay = {};
      result.relay.enabled = settDef.relay.enabled;
    }
    else {
      result.relay = obj.relay;
      result.relay.enabled = typeof(obj.relay.enabled) === "boolean" ? obj.relay.enabled : false;
     }

    if (obj.relay.number === undefined)
      result.relay.number = settDef.relay.number;
    else
      result.relay.number = obj.relay.number;

    if (obj.relay.match === undefined)
      result.relay.match = settDef.relay.match;
    else
      result.relay.match = obj.relay.match;

    if (obj.relay.reply_onmatch === undefined)
      result.relay.reply_onmatch = settDef.relay.reply_onmatch
    else
      result.relay.reply_onmatch = obj.relay.reply_onmatch;

    if (obj.relay.reply_default === undefined)
      result.relay.reply_default = settDef.relay.reply_default;
    else
      result.relay.reply_default = obj.relay.reply_default;

    if (obj.relay.relay_message_format === undefined)
      result.relay.relay_message_format = settDef.relay.relay_message_format;
    else
      result.relay.relay_message_format = obj.relay.relay_message_format;
  }
  else {
    result.relay = settDef.relay;
  }

  if (sKeys[3]) {
    if (obj.debug.console_level === undefined) {
      result.debug = {};
      result.debug.console_level = 'info';
    }else{
      result.debug = obj.debug;
    }
    if (obj.debug.file_level === undefined)
      result.debug.file_level = 'info';
    else
      result.debug.file_level = obj.debug.file_level;

  } else {
    result.debug = {
      console_level: 'info',
      file_level: 'info'
    }
  }

  return result;
}
module.exports = {ini_init, settDef: settDef};
