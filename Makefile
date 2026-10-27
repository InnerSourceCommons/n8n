# Validate all workflow JSON files under nodes/
.PHONY: validate-json
validate-json:
	find nodes -name '*.json' -exec python3 -c 'import json,sys; f=sys.argv[1]; json.load(open(f)); print("Valid:", f)' {} \;

# Write the Code-node JavaScript in src/ into the workflow JSON under nodes/
.PHONY: build
build:
	node scripts/code-nodes.js build

# Fail if the workflow JSON under nodes/ differs from what build would write
.PHONY: check
check:
	node scripts/code-nodes.js check

# Rewrite src/ from each Code node's jsCode, removing files whose node is gone
.PHONY: extract
extract:
	node scripts/code-nodes.js extract
