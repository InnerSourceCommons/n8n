// Flatten structure and produce a list of folders to create for THIS run.
// - Only output folders where `exists === false` AND the parent already exists.
// - Compute parentFolderId from the current Drive state (Build Actual Structure).
//
// On first run: only top-level folders are created.
// On second run: their children are created.
// On third run: grandchildren, etc.
//
// You keep running the workflow until it logs "0 folders to create".

// --- CONFIG & INPUT ---

const rootFolderId = $('Set Configuration').first().json.rootFolderId;
const mainFolderId = rootFolderId;

console.log('Using rootFolderId as mainFolderId:', mainFolderId);

// This comes from "Check Missing Folders"
const folderStatusTree = $('Check Missing Folders').first().json.folders || [];

// From "Build Actual Structure" (current Drive state)
const actualStructure = $('Build Actual Structure').first().json.actualStructure || [];
const allFolders = $('Build Actual Structure').first().json.allFolders || [];

console.log('Actual structure nodes:', actualStructure.length);
console.log('Total folders in allFolders:', allFolders.length);

// --- BUILD path -> folderId MAP FROM CURRENT DRIVE STATE ---

// We'll reconstruct full paths like "00 – Governance/Charter"
const pathToId = new Map();

function buildPathMap(structure, parentPath = '', parentId = mainFolderId) {
  for (const node of structure) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

    // Find the matching folder from allFolders by name + parentId
    const folder = allFolders.find(f => {
      const fParentId = f.parents && f.parents.length > 0 ? f.parents[0] : rootFolderId;
      return f.name === node.name && fParentId === parentId;
    });

    if (folder) {
      pathToId.set(currentPath, folder.id);
      // Recurse into children
      if (node.children && node.children.length > 0) {
        buildPathMap(node.children, currentPath, folder.id);
      }
    }
  }
}

buildPathMap(actualStructure);

console.log('Existing paths in Drive:');
for (const [p, id] of pathToId.entries()) {
  console.log(`  ${p} -> ${id}`);
}

// --- FLATTEN DESIRED STRUCTURE (with exists flags) ---
// We only output folders where:
//   - node.exists === false
//   - the parent "exists" right now (either root or in pathToId / actualStructure)

function flattenForCreation(structure, parentPath = '', parentName = null, depth = 0, parentExists = true) {
  const result = [];

  for (const node of structure) {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const thisExists = node.exists === true;

    // Decide if THIS node should be created in this run
    // Only when it doesn't exist yet, and its parent exists.
    if (!thisExists && parentExists) {
      let parentFolderId;

      if (!parentPath) {
        // Top-level folder under the main/root folder
        parentFolderId = mainFolderId;
      } else {
        // Parent is some subfolder; look it up by its full path
        parentFolderId = pathToId.get(parentPath) || mainFolderId;
      }

      console.log(
        `Scheduling create: "${currentPath}" ` +
        `(depth ${depth}, parentPath="${parentPath}", parentFolderId=${parentFolderId})`
      );

      result.push({
        name: node.name,
        description: node.description || '',
        path: currentPath,
        parentPath,
        parentName,
        depth,
        parentFolderId,
      });
    } else {
      console.log(
        `Skipping for now: "${currentPath}" (exists=${thisExists}, parentExists=${parentExists})`
      );
    }

    // Children: their parent "exists" if:
    //  - this node already exists in Drive (thisExists === true), OR
    //  - we have a path->id entry for it (i.e., it existed before this run).
    const childParentExists = thisExists || pathToId.has(currentPath);

    if (node.children && node.children.length > 0) {
      const childResults = flattenForCreation(
        node.children,
        currentPath,
        node.name,
        depth + 1,
        childParentExists,
      );
      result.push(...childResults);
    }
  }

  return result;
}

const flattened = flattenForCreation(folderStatusTree);

// Sort by depth so parents of this batch are before children of this batch
flattened.sort((a, b) => a.depth - b.depth);

console.log(`\nFound ${flattened.length} folders to create in THIS run:`);
flattened.forEach(f =>
  console.log(
    `  [depth ${f.depth}] ${f.path} (parentPath="${f.parentPath}", parentFolderId=${f.parentFolderId})`,
  ),
);

// Output each folder as a separate item
const outputItems = flattened.map(folder => ({
  json: {
    ...folder,
    mainFolderId,
    rootFolderId,
  },
}));

console.log(`\n=== OUTPUT: Returning ${outputItems.length} items ===`);

return outputItems;

