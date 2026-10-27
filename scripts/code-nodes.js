#!/usr/bin/env node

// Keeps each workflow's Code-node JavaScript in its own .js file under src/
// and writes it back into the workflow JSON under nodes/.
//
//   node scripts/code-nodes.js build    write src/**/*.js into nodes/**/*.json
//   node scripts/code-nodes.js check    exit 1 if nodes/ differs from what build would write
//   node scripts/code-nodes.js extract  rewrite src/ from each Code node's jsCode, removing files whose node is gone
//
// A Code node's source lives at src/<folder under nodes>/<workflow slug>/<node slug>.js,
// where each slug is the name lowercased with every run of non-alphanumeric characters turned into a hyphen.
// Build rewrites only the jsCode string of a node whose code changed, so the rest of
// the JSON stays byte-for-byte as it was and a diff shows only the changed node.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODES_DIR = path.join(ROOT, 'nodes');
const SRC_DIR = path.join(ROOT, 'src');

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p, ext);
    return p.endsWith(ext) ? [p] : [];
  }).sort();
}

function slug(name) {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rel(p) {
  return path.relative(ROOT, p).split(path.sep).join('/');
}

// Finds every "jsCode": "..." string in the raw JSON text, in document order,
// returning where each string literal starts and ends so it can be replaced in place.
function findJsCodeLiterals(raw) {
  const found = [];
  const key = /"jsCode"\s*:\s*"/g;
  let m;
  while ((m = key.exec(raw)) !== null) {
    if (m.index > 0 && raw[m.index - 1] === '\\') continue;
    const start = m.index + m[0].length - 1;
    let i = start + 1;
    while (raw[i] !== '"') {
      if (raw[i] === '\\') i++;
      i++;
      if (i >= raw.length) throw new Error('unterminated jsCode string');
    }
    found.push({ start, end: i + 1, value: JSON.parse(raw.slice(start, i + 1)) });
    key.lastIndex = i + 1;
  }
  return found;
}

// Loads one workflow and pairs each Code node with its jsCode literal in the raw text.
function loadWorkflow(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const workflow = JSON.parse(raw);
  const codeNodes = (workflow.nodes || []).filter(
    (n) => n.parameters && typeof n.parameters.jsCode === 'string'
  );
  const literals = findJsCodeLiterals(raw);
  if (literals.length !== codeNodes.length) {
    throw new Error(`${rel(file)}: found ${literals.length} jsCode strings for ${codeNodes.length} Code nodes`);
  }

  const workflowDir = path.join(
    SRC_DIR,
    path.relative(NODES_DIR, path.dirname(file)),
    slug(path.basename(file, '.json'))
  );
  const seen = new Map();
  const nodes = codeNodes.map((node, i) => {
    if (literals[i].value !== node.parameters.jsCode) {
      throw new Error(`${rel(file)}: jsCode strings are not in node order near "${node.name}"`);
    }
    const srcFile = path.join(workflowDir, `${slug(node.name)}.js`);
    if (seen.has(srcFile)) {
      throw new Error(`${rel(file)}: nodes "${seen.get(srcFile)}" and "${node.name}" both map to ${rel(srcFile)}; rename one`);
    }
    seen.set(srcFile, node.name);
    return { name: node.name, code: node.parameters.jsCode, srcFile, literal: literals[i] };
  });
  return { file, raw, nodes };
}

function loadAll() {
  return walk(NODES_DIR, '.json').map(loadWorkflow);
}

// A .js file holds the code plus one closing newline, so editors that add a final
// newline leave the code unchanged. Line endings are normalized so a Windows
// checkout builds the same JSON as Linux CI.
function toSource(code) {
  return code + '\n';
}

function fromSource(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

// Returns the workflow's raw text with every changed node's jsCode replaced.
function render(workflow, codeFor) {
  let out = '';
  let pos = 0;
  for (const node of workflow.nodes) {
    const code = codeFor(node);
    if (code === node.code) continue;
    out += workflow.raw.slice(pos, node.literal.start) + JSON.stringify(code);
    pos = node.literal.end;
  }
  return out + workflow.raw.slice(pos);
}

function readSources(workflows) {
  const errors = [];
  const expected = new Set();
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      expected.add(node.srcFile);
      if (!fs.existsSync(node.srcFile)) {
        errors.push(`${rel(wf.file)}: Code node "${node.name}" has no source file ${rel(node.srcFile)} (run extract)`);
      }
    }
  }
  for (const f of walk(SRC_DIR, '.js')) {
    if (!expected.has(f)) errors.push(`${rel(f)} matches no Code node in nodes/`);
  }
  if (errors.length) {
    errors.forEach((e) => console.error(`Error: ${e}`));
    process.exit(1);
  }
}

function build(write) {
  const workflows = loadAll();
  readSources(workflows);
  const stale = [];
  for (const wf of workflows) {
    const out = render(wf, (node) => fromSource(fs.readFileSync(node.srcFile, 'utf8')));
    if (out === wf.raw) continue;
    stale.push(rel(wf.file));
    if (write) fs.writeFileSync(wf.file, out);
  }
  if (write) {
    console.log(stale.length ? `Built ${stale.join(', ')}` : 'Workflow JSON already matches src/.');
    return;
  }
  if (stale.length) {
    stale.forEach((f) => console.error(`Error: ${f} does not match its src/ code; run "make build" and commit the result`));
    process.exit(1);
  }
  console.log('Workflow JSON matches src/.');
}

function extract() {
  const workflows = loadAll();
  const written = new Set();
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      // Build re-serializes jsCode with JSON.stringify, so check that the file extract is
      // about to write would rebuild this node's jsCode literal byte for byte.
      const rebuilt = JSON.stringify(fromSource(toSource(node.code)));
      if (rebuilt !== wf.raw.slice(node.literal.start, node.literal.end)) {
        throw new Error(`${rel(wf.file)}: build would not reproduce the jsCode of "${node.name}"`);
      }
      fs.mkdirSync(path.dirname(node.srcFile), { recursive: true });
      fs.writeFileSync(node.srcFile, toSource(node.code));
      written.add(node.srcFile);
    }
  }
  for (const f of walk(SRC_DIR, '.js')) {
    if (!written.has(f)) {
      fs.unlinkSync(f);
      console.log(`Removed ${rel(f)} (no matching Code node)`);
    }
  }
  console.log(`Extracted ${written.size} Code nodes to src/.`);
}

const command = process.argv[2];
if (command === 'build') build(true);
else if (command === 'check') build(false);
else if (command === 'extract') extract();
else {
  console.error('Usage: node scripts/code-nodes.js build|check|extract');
  process.exit(1);
}
