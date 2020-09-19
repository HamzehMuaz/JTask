const xml2js = require('xml2js');
const fs = require('fs');
var parser = require('xml2json');
var flatten = require('flat')
const cleanDeep = require('clean-deep');

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

  await fs.writeFileSync('./xml/pacs002BuiltXml.xml', pacs002BuiltXml);

  console.log('Done');
}

// Main //
readXml();
//