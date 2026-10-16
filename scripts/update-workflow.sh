#!/bin/bash

# Pushes one workflow JSON file to https://innersourcecommons.app.n8n.cloud/
# using the API key in $N8N_API_KEY. CI runs this for each workflow merged to main.
# Exits non-zero unless the API answers 200.

# Check if a file was provided
if [ -z "$1" ]; then
  echo "Usage: ./update-workflow.sh <path-to-workflow.json>"
  exit 1
fi

if [ -z "$N8N_API_KEY" ]; then
  echo "Error: N8N_API_KEY is not set."
  exit 1
fi

WORKFLOW_FILE="$1"
BASE_URL="https://innersourcecommons.app.n8n.cloud/api/v1"

# Extract Workflow ID from the JSON file using jq for accuracy
WORKFLOW_ID=$(jq -r '.id' "$WORKFLOW_FILE")

if [ -z "$WORKFLOW_ID" ] || [ "$WORKFLOW_ID" == "null" ]; then
  echo "Error: Could not extract workflow ID from file."
  exit 1
fi

echo "Updating Workflow ID: $WORKFLOW_ID"

# Create a temporary file with the cleaned JSON payload
# Select only allowed fields and remove null values (active and tags are read-only)
CLEAN_JSON_FILE=$(mktemp)
jq '{name, nodes, connections, settings, staticData} | with_entries(select(.value != null))' "$WORKFLOW_FILE" > "$CLEAN_JSON_FILE"

# Update the workflow
# The API expects the workflow JSON object in the body.
# We assume the file contains the full workflow object.
RESPONSE_FILE=$(mktemp)
status=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" -X PUT "$BASE_URL/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$CLEAN_JSON_FILE")

# Clean up
rm "$CLEAN_JSON_FILE"

if [ "$status" == "200" ]; then
  echo "Successfully updated workflow."
  rm "$RESPONSE_FILE"
else
  echo "Failed to update workflow (HTTP $status). Response:"
  cat "$RESPONSE_FILE"
  rm "$RESPONSE_FILE"
  exit 1
fi

