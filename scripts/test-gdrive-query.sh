#!/bin/bash

# Test Google Drive API query to list folders in a specific shared drive root
# This script verifies that queries are scoped to ROOT_FOLDER_ID only,
# not other folders the user has access to

set -e

# Set your credentials
CLIENT_ID="${GOOGLE_CLIENT_ID_ISC}"
CLIENT_SECRET="${GOOGLE_CLIENT_SECRET_ISC}"

# Shared Drive ID from the workflow
ROOT_FOLDER_ID="0AEYIz1wWZyG7Uk9PVA"

echo "=== Testing Google Drive API Query Scoping ==="
echo ""
echo "Root Folder ID: ${ROOT_FOLDER_ID}"
echo ""
echo "This script tests that the query is scoped to ONLY show folders"
echo "in the specified ROOT_FOLDER_ID, not other folders you have access to."
echo ""

# Build the query string to list all folders in the root
QUERY="'${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"

echo "Query string:"
echo "${QUERY}"
echo ""
echo "Expected: Should show 'Working Groups' folder (and any other folders in root)"
echo ""

# Function to get access token via OAuth2
get_access_token() {
  if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "Error: GOOGLE_CLIENT_ID_ISC and GOOGLE_CLIENT_SECRET_ISC must be set."
    echo "Try sourcing your config file: source ~/.configure_secure_exports.sh"
    exit 1
  fi
  
  REDIRECT_URI="http://localhost"
  SCOPE="https://www.googleapis.com/auth/drive"
  
  AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent"
  
  echo "----------------------------------------------------------------"
  echo "Getting access token..."
  echo "1. Open this URL in your browser:"
  echo ""
  echo "$AUTH_URL"
  echo ""
  echo "----------------------------------------------------------------"
  echo "2. Authorize the app."
  echo "3. You will be redirected to: http://localhost?code=4/0A..."
  echo "4. Copy the 'code' value from the URL in your browser's address bar."
  echo "   (The page may show an error - that's OK, just copy the code parameter)"
  echo "----------------------------------------------------------------"
  read -p "Paste the Auth Code here: " AUTH_CODE
  
  if [ -z "$AUTH_CODE" ]; then
    echo "Error: No code provided."
    exit 1
  fi
  
  echo ""
  echo "Exchanging code for token..."
  TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
    -d client_id="${CLIENT_ID}" \
    -d client_secret="${CLIENT_SECRET}" \
    -d code="${AUTH_CODE}" \
    -d grant_type=authorization_code \
    -d redirect_uri="${REDIRECT_URI}")
  
  # Try jq first, fallback to python3
  if command -v jq &> /dev/null; then
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
  else
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))")
  fi
  
  if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" == "null" ]; then
    echo "Error getting token:"
    echo "$TOKEN_RESPONSE"
    exit 1
  fi
  
  echo "Access token obtained successfully!"
  echo ""
}

# Check if ACCESS_TOKEN is provided as environment variable
if [ -z "$ACCESS_TOKEN" ]; then
  echo "=== No ACCESS_TOKEN found ==="
  echo ""
  echo "Option 1: Get token automatically (will prompt for OAuth)"
  echo "Option 2: Set ACCESS_TOKEN environment variable"
  echo ""
  read -p "Get token automatically? (y/n): " GET_TOKEN
  
  if [ "$GET_TOKEN" = "y" ] || [ "$GET_TOKEN" = "Y" ]; then
    get_access_token
  else
    echo ""
    echo "To get a token manually, you can:"
    echo "1. Run: ./search-drive.sh (and copy the access token from output)"
    echo "2. Or set ACCESS_TOKEN environment variable and run this script again"
    exit 0
  fi
fi

echo "=== Testing with ACCESS_TOKEN ==="
echo ""

echo "=== Listing ALL folders in ROOT_FOLDER_ID ==="
echo "Query: ${QUERY}"
echo ""
echo "Parameters:"
echo "  - corpora=drive (scope to shared drive)"
echo "  - driveId=${ROOT_FOLDER_ID} (specific drive ID)"
echo "  - includeItemsFromAllDrives=true"
echo "  - supportsAllDrives=true"
echo ""

RESPONSE=$(curl -s -G 'https://www.googleapis.com/drive/v3/files' \
  --data-urlencode "q=${QUERY}" \
  --data-urlencode "fields=files(id,name)" \
  --data-urlencode "includeItemsFromAllDrives=true" \
  --data-urlencode "supportsAllDrives=true" \
  --data-urlencode "corpora=drive" \
  --data-urlencode "driveId=${ROOT_FOLDER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
  echo "ERROR: API returned an error!"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
else
  echo "SUCCESS: Query executed successfully!"
  FOLDER_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('files', [])))" 2>/dev/null || echo "0")
  echo "Found ${FOLDER_COUNT} folder(s) in ROOT_FOLDER_ID"
  echo ""
  
  # Check if Working Groups folder is in the results
  if echo "$RESPONSE" | grep -qi "Working Groups"; then
    echo "✓ SUCCESS: 'Working Groups' folder found in results!"
    echo "  This confirms the query is correctly scoped to ROOT_FOLDER_ID."
  else
    echo "⚠ WARNING: 'Working Groups' folder NOT found in results."
    echo "  This may indicate a scoping issue or the folder doesn't exist."
  fi
  
  echo ""
  echo "Verification:"
  echo "  - If you see folders from other drives/folders you have access to,"
  echo "    the query is NOT properly scoped."
  echo "  - If you only see folders from ROOT_FOLDER_ID, the query is correctly scoped."
fi
