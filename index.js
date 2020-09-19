const xml2js = require('xml2js');
const fs = require('fs');
var parser = require('xml2json');
var xsdModule = require('xsd');
var flatten = require('flat')
const cleanDeep = require('clean-deep');

const readXml = async () => {
  const xsd = await fs.readFileSync('./xsd/pacs.002.001.10.xsd').toString();
  const xsd2 = await fs.readFileSync('./xsd/pacs.009.001.08.NET.xsd').toString();
  const xml = await fs.readFileSync('./xml/PACS002.xml').toString();
  const xml9 = await fs.readFileSync('./xml/PACS009.xml').toString();
  // const json = await xml2js.parseStringPromise(xsd);


  const Xsd2JsonSchema = require('xsd2jsonschema').Xsd2JsonSchema;
  const xs2js = new Xsd2JsonSchema();
   
  const convertedSchemas = xs2js.processAllSchemas({
      schemas: {'pacs.002.xsd': xsd, 'pacs.009.xsd': xsd2}
  });
  const jsonSchema = convertedSchemas['pacs.002.xsd'].getJsonSchema();
  const jsonSchema2 = convertedSchemas['pacs.009.xsd'].getJsonSchema();


  var pacs2JsonSchemaStr = parser.toJson(xsd);
  var jsonString2 = parser.toJson(xml);
  var jsonString9 = parser.toJson(xml9);
  const pacs9JsonSchemaStr = parser.toJson(xsd2);
  const pacs2JsonSchema = JSON.parse(pacs2JsonSchemaStr)
  const json2 = JSON.parse(jsonString2)
  const json9 = JSON.parse(jsonString9)
  const pacs9JsonSchema = JSON.parse(pacs9JsonSchemaStr)
  const flat91 = flatten(json9)
  const flat9 = flatJson(json9)
  // const flat911 = flatJson(json)
  const simplePacs9 = simplify(pacs9JsonSchema);
  const simplePacs2 = simplify(pacs2JsonSchema);
  const parents = findParents(simplePacs2);
  const children = findChildren(simplePacs2);
  const children2 = findChildren(simplePacs9);
  
  const pacs002Built = buildPACS002(children, flat9, flat91);
  const cleanPacs002 = cleanDeep(pacs002Built);

  const PACS002Structre = pacs002Header();
  PACS002Structre.DataPDU.Body = cleanPacs002;

  var builder = new xml2js.Builder();
  var pacs002BuiltXml = builder.buildObject(PACS002Structre);

  await fs.writeFileSync('./xml/pacs002BuiltXml.xml', pacs002BuiltXml);

  console.log(json);
}

readXml();

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

const buildPACS002 = (pacs002Children, flatPacs009, flat91) => {
  const doc = pacs002Children.Document;
  const json = { Document: fill(pacs002Children, flatPacs009, doc, flat91) };

  return json;
}

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


const fill = (pacs002Children, flatPacs009, current, flat91) => {
  const j = {};
  // if (current && Array.isArray(current)) {
    for (const el of current) {
      const { name, type } = el;
      if (pacs002Children[type]) {
        j[name] = fill(pacs002Children, flatPacs009, pacs002Children[type], flat91);
      } else {
        // if (flatPacs009[name] && flatPacs009[name].length > 1) {
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
          console.log(flatPacs009[name]);
        // }
        // j[name] = flatPacs009[name] ? flatPacs009[name].name : 'None';
        if (op && op.length) {
          j[name] = op[0].value
        }
      }
    }
  // }
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

// const flatJson = (j, flat = {}, key = 'root') => {
//   if (typeof j == 'object' && !Array.isArray(j)) {
//     for (key in j) {
//       if (key && j[key] != null) {
//         flat = flatJson(j[key], flat, key);
//       }
//     }
//   } else if (typeof j == 'object' && Array.isArray(j)) {
//     let i = 0;
//     for (const element of j) {
//       if (element != null) {
//         flat = flatJson(element, flat, `${key}//${i}`);
//       }
//       i++;
//     }
//   } else {
//     flat[key] = j
//   }
//   return flat;
// }

const flatJson = (j, flat = {}, key = 'root', parent) => {
  parent = parent || key;
  if (typeof j == 'object' && !Array.isArray(j)) {
    parent = key;
    for (key in j) {
      if (key && j[key] != null) {
        flat = flatJson(j[key], flat, key, parent);
      }
    }
  } else if (typeof j == 'object' && Array.isArray(j)) {
    parent = key;
    let i = 0;
    for (const element of j) {
      if (element != null) {
        flat = flatJson(element, flat, `${key}//${i}`, parent);
      }
      i++;
    }
  } else {
    if (!flat[key]) flat[key] = [];
    flat[key].push({name: j, key, parent})
  }
  return flat;
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

const cleanJson = (j) => {
  if (typeof j !== 'object') {
    return j;
  }
  if (!Object.keys(j).every((key) => {

  }))
  for (const key in j) {
    if (key == 'RfrdDocInf') {
      console.log('g')
    }
    if (Object.keys(j[key]).length == 0) {
      delete j[key];
    } else {
      cleanJson(j[key]);
    }
  }
  return j;
}
// const nameToType = (j) => {
//   let map = {};
//   if (Array.isArray(j)) {
//     for (const el of j) {
//       map = nameToType(el);
//     }
//   } else {
//     for (const key in j) {
//       if (j[key] && typeof j[key] == 'object')
//       map = nameToType(j[key]);
//     }
//   }
//   if (j.name) {
//     if (!map[j.name]) map[j.name] = [];
//     map[j.name].push({ name: j.name, type: j.type });
//   }
//   return map;
// }