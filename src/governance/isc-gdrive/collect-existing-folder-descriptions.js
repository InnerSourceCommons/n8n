const folders = $json.folders || [];
const allFolders = $('Build Actual Structure').first().json.allFolders || [];
const rootFolderId = $('Set Configuration').first().json.rootFolderId;

const folderLookup = new Map();
for (const f of allFolders) {
  const parentId = f.parents && f.parents.length > 0 ? f.parents[0] : rootFolderId;
  folderLookup.set(`${parentId}::${f.name}`, f.id);
}

const results = [];

function collect(nodes, parentFolderId) {
  for (const node of nodes) {
    const key = `${parentFolderId}::${node.name}`;
    const folderId = folderLookup.get(key);

    if (folderId && node.description) {
      results.push({
        json: {
          folderId,
          name: node.name,
          description: node.description
        }
      });
    }

    if (folderId && node.children && node.children.length > 0) {
      collect(node.children, folderId);
    }
  }
}

collect(folders, rootFolderId);

console.log(`Found ${results.length} existing folders with descriptions to update`);

return results.length > 0 ? results : [];
