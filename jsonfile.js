const jsonfile = require('jsonfile');
const _ = require('lodash');
const { env } = require('./env');

function readJson() {
  try {
    return jsonfile.readFileSync(env.jsonFileName);
  } catch (error) {
    return {};
  }
}
exports.readJson = readJson;

function appendJson(path, value) {
  let json = readJson();

  _.set(json, [env.G_SAP, path].join('.'), value);

  // console.log(json);
  return jsonfile.writeFileSync(env.jsonFileName, json);
}
exports.appendJson = appendJson;
