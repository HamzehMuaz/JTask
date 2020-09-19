const xml2js = require('xml2js');
const fs = require('fs');
var parser = require('xml2json');
var flatten = require('flat')
const cleanDeep = require('clean-deep');

// Constants
const valueMapping = {
  MsgNmId: 'MsgDefIdr',
}

const defaultValue = {
  MsgId: 'CLIQ12030',
  GrpSts: 'ACSC',
  TxSts: 'ACSC',
  InstdAgt: 'none',
}

const targetParents = {
  BICFI: 'InstdAgt',
}

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


// Handlers & Helpers below:
const pacs002Header = () => {
  const structure = {
    DataPDU: {
      $: {
        "xmlns": "urn:swift:saa:xsd:saa.2.0",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      },
      Revision: '2.0.5',
      Header: {
        Message: {
          SenderReference: 'CLIQ12030', // static
          MessageIdentifier: 'pacs.002.001.10',
          Format: 'MX',
          Sender: 'CBJOJOAXCRTG',
          Receiver: 'CBJOJOAXXIPS',
        }
      },
      Body: {},
    }
  }
  return structure;
}

const buildPACS002 = (pacs002Children, flat91) => {
  const doc = pacs002Children.Document;
  const json = { Document: fill(pacs002Children, doc, flat91) };

  return json;
}

const fill = (pacs002Children, current, flat91) => {
  const j = {};
    for (const el of current) {
      const { name, type } = el;
      if (pacs002Children[type]) {
        j[name] = fill(pacs002Children, pacs002Children[type], flat91);
      } else {
          let alias = name;
          if (name.substr(0, 5) == 'Orgnl') {
            alias = name.substr(5, name.length - 5)
          }
          const answer = getAnswer(alias);
          if (answer && typeof answer == 'string') {
            if (answer == 'none') continue;
            j[name] = answer;
            continue;
          }
          if (answer && typeof answer == 'object') {
            alias = answer.altKey;
          }
          const op = findEl(flat91, alias, targetParents[alias]);
        if (op && op.length) {
          j[name] = op[0].value
        }
      }
    }
  return j;
}

const getAnswer = (key) => {
  if (defaultValue[key]) {
    return defaultValue[key]
  }
  if (valueMapping[key]) {
    return { altKey: valueMapping[key] };
  }
  return null;
}

const findEl = (flat91, toFind, targetParent) => {
  let options = [];
  for (const key in flat91) {
    const length = toFind.length;
    if (key.substr(key.length - length, length) == toFind) {
      options.push({ value: flat91[key], path: key, parents: key.split('.') })
    }
  }
  if (options.length > 1 && targetParent) {
    options = options.filter((o) => o.parents.includes(targetParent));
  } 
  return options;
}

const simplify = (j) => {
  const body = j['xs:schema'];
  const comType = body['xs:complexType'];
  let s = {};
  let m = {};
  for (const el of comType) {
    m = nameToType(el, null, m);
    // m = { ...m, ...value};
    s = { ...s, ...m };
  }
  return s;
}

const nameToType = (j, parent, map = {}) => {
  if (!parent) {
    parent = j.name || 'none';
  }
  if (Array.isArray(j)) {
    for (const el of j) {
      map = {...map, ...nameToType(el, parent, map)};
    }
  } else {
    for (const key in j) {
      if (j[key] && typeof j[key] == 'object')
      map = {...map, ...nameToType(j[key], parent, map)};
    }
  }

  if (typeof j == 'object' && !Array.isArray(j) && Object.keys(j).some((key) => typeof j[key] == 'object')) {
    if (!map.types) map.types = {}
    if (j.name) {
      map.types[j.name] = j.name;
    }
  } else {
    if (j.name) {
      // if (!map[j.name]) map[j.name] = [];
      parent = parent == j.name ? 'root' : parent;
      map[j.name] = { name: j.name, type: j.type, parent };
    }
  }

  return map;
}

const findParents = (j) => {
  const parents = {};
  const q = ['Document'];
  while (q.length) {
    let toFind = q.pop();
    let found = false;
    for (const key in j) {
      const el = j[key]
      if (el.parent == toFind) {
        q.push(el.type);
        found = true;
        parents[el.type] = toFind;
      }
    }
  }
  return parents;
}

const findChildren = (j) => {
  const children = {};
  const q = ['Document'];
  while (q.length) {
    let toFind = q.pop();
    for (const key in j) {
      const el = j[key]
      if (el.parent == toFind) {
        q.push(el.type);
        if (!children[toFind]) {
          children[toFind] = [];
        }
        if (children[toFind] && !children[toFind].find((existing) => existing.name == el.name && existing.type == el.type)) {
          children[toFind].push({ name:el.name, type: el.type });
        }
      }
    }
  }
  return children;
}
