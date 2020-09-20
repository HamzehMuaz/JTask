const xml2js = require('xml2js');
const fs = require('fs');
var parser = require('xml2json');
var flatten = require('flat')
const cleanDeep = require('clean-deep');
const moment = require('moment');

const {
  pacs002Header,
  buildPACS002,
  simplify,
  findChildren,
} = require('./helpers');

const readXml = async () => {
  const PACS002xsd = await fs.readFileSync('./xsd/pacs.002.001.10.xsd').toString();
  const PACS009xml = await fs.readFileSync('./xml/PACS009.xml').toString();

  const pacs2JsonSchemaStr = parser.toJson(PACS002xsd);
  const pacs2JsonSchema = JSON.parse(pacs2JsonSchemaStr);
  const simplePacs2 = simplify(pacs2JsonSchema);
  const PACS002children = findChildren(simplePacs2);

  const PACS009JsonString = parser.toJson(PACS009xml);
  const PACS009Json = JSON.parse(PACS009JsonString)
  const PACS009Flat = flatten(PACS009Json)
  
  const pacs002Built = buildPACS002(PACS002children, PACS009Flat);
  const cleanPacs002 = cleanDeep(pacs002Built);

  const PACS002Structre = pacs002Header();
  PACS002Structre.DataPDU.Body = cleanPacs002;

  var builder = new xml2js.Builder();
  var pacs002BuiltXml = builder.buildObject(PACS002Structre);

  const {text, name} = createSTMTR();
  await fs.writeFileSync(`./stmtr/${name}`, text);

  await fs.writeFileSync('./xml/pacs002BuiltXml.xml', pacs002BuiltXml);

  console.log('Done');
}

const createSTMTR = () => {
  const firstLine = `STMTRJIPSRTGSJOD${moment().format('YYYYMMD')}83900000002`;
  const text = `${firstLine}
  ARAB00000000400,000C
  UBSI00000000400,000D
  00000000400,00000000000400,000`;
  return {text, name: firstLine};
}

// Main //
readXml();
//