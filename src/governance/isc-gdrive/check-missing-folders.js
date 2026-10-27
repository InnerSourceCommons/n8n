const folders = $json.folders || [];

function collectMissing(structure, parentPath = "") {
  let missing = [];
  for (const node of structure) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.exists === false) {
      missing.push(currentPath);
    }
    if (node.children && node.children.length > 0) {
      missing = missing.concat(collectMissing(node.children, currentPath));
    }
  }
  return missing;
}

const missingList = collectMissing(folders);
const missingCount = missingList.length;
const missingFoldersText = missingList.join("\n");

console.log("Missing folders:", missingCount);
console.log("Missing folders list:", missingFoldersText);

return [{ json: { folders, missingCount, hasMissing: missingCount > 0, missingFoldersText } }];
