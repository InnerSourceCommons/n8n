#!/bin/bash

# Check if a file was provided
if [ -z "$1" ]; then
  echo "Usage: ./update-workflow.sh <path-to-workflow.json>"
  exit 1
fi

WORKFLOW_FILE="$1"
BASE_URL="https://n8n-pm2n3z2t7q-uw.a.run.app/api/v1"

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
response=$(curl -s -X PUT "$BASE_URL/workflows/$WORKFLOW_ID" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$CLEAN_JSON_FILE")

# Clean up
rm "$CLEAN_JSON_FILE"

# Check if update was successful (look for id in response)
if echo "$response" | grep -q "\"id\":\"$WORKFLOW_ID\""; then
  echo "Successfully updated workflow."
else
  echo "Failed to update workflow. Response:"
  echo "$response"
  exit 1
fi

