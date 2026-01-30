# Validate all workflow JSON files under nodes/
.PHONY: validate-json
validate-json:
	find nodes -name '*.json' -exec python3 -c 'import json,sys; f=sys.argv[1]; json.load(open(f)); print("Valid:", f)' {} \;
