// Compare desired structure with actual structure
// Include ALL folders with exists: true/false field

// Decode HTML entities that n8n expression rendering may introduce
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Recursively decode HTML entities in all name fields
function decodeNames(nodes) {
  return nodes.map(node => {
    const decoded = { ...node, name: decodeHtmlEntities(node.name) };
    if (decoded.children && decoded.children.length > 0) {
      decoded.children = decodeNames(decoded.children);
    }
    return decoded;
  });
}

const rawDesired = typeof $('Set Configuration').first().json.desiredStructure === 'string'
  ? JSON.parse($('Set Configuration').first().json.desiredStructure)
  : $('Set Configuration').first().json.desiredStructure;

const desiredStructure = decodeNames(rawDesired);

const actualStructure = $json.actualStructure || [];

console.log('Desired structure:', JSON.stringify(desiredStructure, null, 2));
console.log('Actual structure:', JSON.stringify(actualStructure, null, 2));

// Build a lookup map: parentName -> Map<childName, exists>
// This allows us to check if a folder exists by its name and parent context
function buildNameMap(structure, parentName = null) {
  const nameMap = new Map(); // parentName -> Set<childNames>
  
  function processNode(node, parent) {
    const parentKey = parent || 'ROOT';
    if (!nameMap.has(parentKey)) {
      nameMap.set(parentKey, new Set());
    }
    nameMap.get(parentKey).add(node.name);
    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        processNode(child, node.name);
      }
    }
  }
  
  for (const node of structure) {
    processNode(node, null);
  }
  
  return nameMap;
}

const actualNameMap = buildNameMap(actualStructure);

console.log('Actual name map:', JSON.stringify(
  Array.from(actualNameMap.entries()).map(([k, v]) => [k, Array.from(v)]),
  null, 2
));

// Function to check if a folder exists by name and parent
function folderExists(folderName, parentName = null) {
  const parentKey = parentName || 'ROOT';
  const exists = actualNameMap.has(parentKey) && actualNameMap.get(parentKey).has(folderName);
  
  // Debug: log what we're checking
  if (!exists) {
    console.log(`  Folder NOT found: name="${folderName}", parent="${parentKey}"`);
    if (actualNameMap.has(parentKey)) {
      console.log(`  Available children in ${parentKey}:`, Array.from(actualNameMap.get(parentKey)));
    } else {
      console.log(`  Parent ${parentKey} not found in actual structure`);
    }
  } else {
    console.log(`  ✓ Folder found: name="${folderName}", parent="${parentKey}"`);
  }
  
  return exists;
}

// Function to recursively check folders and add exists field
function checkFolders(desiredNode, parentName = null) {
  const exists = folderExists(desiredNode.name, parentName);
  
  console.log(`Checking folder: ${desiredNode.name}, parent: ${parentName || 'ROOT'}, exists: ${exists}`);
  
  const result = {
    name: desiredNode.name,
    exists: exists
  };
  
  if (desiredNode.description) {
    result.description = desiredNode.description;
  }
  
  // Check children - always include all children
  if (desiredNode.children && desiredNode.children.length > 0) {
    result.children = desiredNode.children.map(child => 
      checkFolders(child, desiredNode.name)
    );
  }
  
  return result;
}

// Check all folders
const folderStatus = desiredStructure.map(node => checkFolders(node));

console.log('Folder status:', JSON.stringify(folderStatus, null, 2));

return [{ json: { folders: folderStatus } }];
