# Validate all workflow JSON files under nodes/
.PHONY: validate-json
validate-json:
	find nodes -name '*.json' -exec python3 -c 'import json,sys; f=sys.argv[1]; json.load(open(f)); print("Valid:", f)' {} \;

# Write every workflow, with its Code-node code filled in from src/, to dist/
.PHONY: build
build:
	node scripts/code-nodes.js build

# Fail unless every Code node points at a source file in src/ and every source file is used
.PHONY: check
check:
	node scripts/code-nodes.js check

# Move real code found in the workflow JSON into src/, leaving placeholders
.PHONY: extract
extract:
	node scripts/code-nodes.js extract
