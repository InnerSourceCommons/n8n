// Build hierarchical structure from flat list of folders
// Convert Google Drive folder structure to JSON matching the desired structure format

const rootFolderId = $('Set Configuration').first().json.rootFolderId;
// HTTP Request shape: { files: [...] }. Google Drive Search: one item per folder.
const allFolders = Array.isArray($json.files)
  ? $json.files
  : $input.all().map((item) => item.json);

console.log('Total folders found in Google Drive:', allFolders.length);

// Build a map: parentId -> [children]
const childrenMap = new Map();
for (const folder of allFolders) {
  const parentId = folder.parents && folder.parents.length > 0 ? folder.parents[0] : rootFolderId;
  if (!childrenMap.has(parentId)) {
    childrenMap.set(parentId, []);
  }
  childrenMap.get(parentId).push({
    id: folder.id,
    name: folder.name
  });
}

console.log('Folders directly under root:', childrenMap.get(rootFolderId)?.length || 0);

// Build tree structure starting directly from rootFolderId
// Function to recursively build tree structure
function buildTree(parentId) {
  const children = childrenMap.get(parentId) || [];
  return children.map(child => {
    const node = { name: child.name };
    const childChildren = buildTree(child.id);
    if (childChildren.length > 0) {
      node.children = childChildren;
    }
    return node;
  });
}

// Build tree starting from rootFolderId (which is now a folder, not a drive root)
const actualStructure = buildTree(rootFolderId);

console.log('Actual structure built:', JSON.stringify(actualStructure, null, 2));

return [{ json: { actualStructure, allFolders } }];
