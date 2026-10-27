#!/usr/bin/env node

// Keeps each workflow's Code-node JavaScript in its own .js file under src/.
// In the committed workflow JSON under nodes/, each Code node's jsCode is a one-line
// placeholder naming its source file, and the code is filled in whenever the workflow
// is published or built.
//
//   node scripts/code-nodes.js render <workflow.json>  print the workflow with its code filled in
//   node scripts/code-nodes.js build                   write every filled-in workflow to dist/
//   node scripts/code-nodes.js check                   exit 1 unless every Code node points at a source file and every source file is used
//   node scripts/code-nodes.js extract                 move real code found in nodes/ into src/, leaving placeholders
//   node scripts/code-nodes.js affected                read changed paths (NUL-separated) on stdin, print the workflows they touch
//
// Extract names a Code node's source file src/<folder under nodes>/<workflow slug>/<node slug>.js,
// where each slug is the name lowercased with every run of non-alphanumeric characters turned into a hyphen.
// Every edit replaces only jsCode strings, so the rest of the JSON stays byte-for-byte as it was.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODES_DIR = path.join(ROOT, 'nodes');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');

const PLACEHOLDER = /^\/\/ Code comes from (src\/\S+\.js) at build time\.$/;

function placeholder(srcFile) {
  return `// Code comes from ${rel(srcFile)} at build time.`;
}

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
// A node whose jsCode is a placeholder gets the source file it names; any other node
// holds real code and gets the source file extract would write it to.
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
  const nodes = codeNodes.map((node, i) => {
    const code = node.parameters.jsCode;
    if (literals[i].value !== code) {
      throw new Error(`${rel(file)}: jsCode strings are not in node order near "${node.name}"`);
    }
    const m = code.match(PLACEHOLDER);
    const srcFile = m ? path.join(ROOT, m[1]) : path.join(workflowDir, `${slug(node.name)}.js`);
    return { name: node.name, code, isPlaceholder: !!m, srcFile, literal: literals[i] };
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

// Returns the workflow's raw text with each node's jsCode string replaced by codeFor(node).
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

function readSource(node) {
  return fromSource(fs.readFileSync(node.srcFile, 'utf8'));
}

// Lists everything that keeps the workflows from building; with all set, the workflows
// are the whole of nodes/ and a source file none of them uses is a problem too.
function problems(workflows, all = true) {
  const errors = [];
  const used = new Map();
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      const where = `${rel(wf.file)}: Code node "${node.name}"`;
      if (!node.isPlaceholder) {
        errors.push(`${where} holds its code in the JSON; run "make extract" to move it to src/`);
        continue;
      }
      if (used.has(node.srcFile)) {
        errors.push(`${where} points at ${rel(node.srcFile)}, which ${used.get(node.srcFile)} already uses`);
      }
      used.set(node.srcFile, where);
      if (!fs.existsSync(node.srcFile)) errors.push(`${where} points at ${rel(node.srcFile)}, which does not exist`);
    }
  }
  for (const f of all ? walk(SRC_DIR, '.js') : []) {
    if (!used.has(f)) errors.push(`${rel(f)} is used by no Code node in nodes/`);
  }
  return errors;
}

function failOn(errors) {
  if (!errors.length) return;
  errors.forEach((e) => console.error(`Error: ${e}`));
  process.exit(1);
}

function renderOne(file) {
  const wf = loadWorkflow(path.resolve(file));
  failOn(problems([wf], false));
  process.stdout.write(render(wf, readSource));
}

function build() {
  const workflows = loadAll();
  failOn(problems(workflows));
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  for (const wf of workflows) {
    const out = path.join(DIST_DIR, path.relative(NODES_DIR, wf.file));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(wf, readSource));
  }
  console.log(`Built ${workflows.length} workflows into dist/.`);
}

function check() {
  failOn(problems(loadAll()));
  console.log('Every Code node points at a source file in src/.');
}

function extract() {
  const workflows = loadAll();
  const claimed = new Map();
  for (const wf of workflows) {
    for (const node of wf.nodes) {
      const owner = `${rel(wf.file)}: "${node.name}"`;
      if (claimed.has(node.srcFile)) {
        throw new Error(`${owner} and ${claimed.get(node.srcFile)} both map to ${rel(node.srcFile)}; rename one`);
      }
      claimed.set(node.srcFile, owner);
    }
  }

  let moved = 0;
  for (const wf of workflows) {
    const real = wf.nodes.filter((node) => !node.isPlaceholder);
    if (!real.length) continue;
    for (const node of real) {
      // Publishing re-serializes the code with JSON.stringify, so check that the file
      // extract is about to write would rebuild this node's jsCode literal byte for byte.
      const rebuilt = JSON.stringify(fromSource(toSource(node.code)));
      if (rebuilt !== wf.raw.slice(node.literal.start, node.literal.end)) {
        throw new Error(`${rel(wf.file)}: publishing would not reproduce the jsCode of "${node.name}"`);
      }
      fs.mkdirSync(path.dirname(node.srcFile), { recursive: true });
      fs.writeFileSync(node.srcFile, toSource(node.code));
      moved++;
    }
    fs.writeFileSync(wf.file, render(wf, (node) => (node.isPlaceholder ? node.code : placeholder(node.srcFile))));
  }

  for (const f of walk(SRC_DIR, '.js')) {
    if (!claimed.has(f)) {
      fs.unlinkSync(f);
      console.log(`Removed ${rel(f)} (no matching Code node)`);
    }
  }
  console.log(`Moved ${moved} Code nodes' code into src/.`);
}

// Publishing on merge sends the workflows a push touched: each changed workflow JSON,
// plus each workflow with a Code node whose source file changed.
function affected() {
  const changed = new Set(
    fs.readFileSync(0, 'utf8').split('\0').filter(Boolean).map((p) => path.join(ROOT, p))
  );
  const out = loadAll()
    .filter((wf) => changed.has(wf.file) || wf.nodes.some((node) => changed.has(node.srcFile)))
    .map((wf) => `${rel(wf.file)}\0`);
  process.stdout.write(out.join(''));
}

const [command, arg] = process.argv.slice(2);
if (command === 'render' && arg) renderOne(arg);
else if (command === 'build') build();
else if (command === 'check') check();
else if (command === 'extract') extract();
else if (command === 'affected') affected();
else {
  console.error('Usage: node scripts/code-nodes.js render <workflow.json>|build|check|extract|affected');
  process.exit(1);
}
