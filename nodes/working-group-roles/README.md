# ISC - Scribe Workflow

This n8n workflow automates creating meeting notes for the ISPO Working Group by copying a Google Doc template, renaming it with a date, and updating the content.

## Features

- **Duplicate Check**: Checks if a file with the target name already exists to prevent duplicates.
- **Template Copy**: Copies a master template Google Doc.
- **Content Replacement**: Replaces placeholder text (e.g., `MMMM D, YYYY`) in the document with the actual meeting date.
- **Dual Triggers**: Can be run manually from the n8n UI or via a Webhook.

## Prerequisites

### Credentials
You need the following credentials configured in n8n:
1.  **Google Drive OAuth2 API**: For searching and copying files.
2.  **Google Docs OAuth2 API**: For updating the document content.

### Configuration
The workflow uses a specific Google Doc as a template.
- **Node**: "Copy file"
- **Parameter**: `fileId`
- **Current Value**: `1_TJQopWFtbmAJhaObVJnRS60Lsr6VHyw1ytwhZwrU6U`

If the template document changes, you must update this File ID in the "Copy file" node.

## Usage

### 1. Manual Execution (Testing)
In the n8n Editor:
1.  Click "Execute Workflow".
2.  The "When clicking ‘Execute workflow’" node provides a test date (`2025-12-01`).

### 2. Webhook Trigger
You can trigger the workflow via an HTTP POST request.

**Endpoint:**
- **Test**: `https://<your-n8n-instance>/webhook-test/isc-scribe` (requires workflow to be open in UI)
- **Production**: `https://<your-n8n-instance>/webhook/isc-scribe` (requires workflow to be Active)

**Payload:**
```json
{
  "date": "YYYY-MM-DD",
  "roles": {
    "scheduler": "Scheduler Role",
    "crier": "Crier Role",
    "facilitator": "Facilitator Role",
    "scribe": "Scribe Role"
   }
}
```

**Example (Test URL):**
```bash
curl --silent -X POST https://n8n.unintelligent-design.us/webhook-test/isc-scribe \
 -H "Content-Type: application/json" \
 -d '{"date": "2025-11-22", "roles": { "scheduler": "Scheduler Role", "crier": "Crier Role", "facilitator": "Facilitator Role", "scribe": "Scribe Role" }}'
```

## Deployment & Updates

To update the workflow on the server after making local changes to the JSON file:

1.  Ensure your `N8N_API_KEY` is set in your environment.
2.  Run the update script:

```bash
./update-workflow.sh "nodes/isc/ISC - Scribe.json"
```

This script will:
1.  Update the workflow definition on the server.
2.  Activate the workflow.

## Viewing Workflow Execution Plan

View the execution plan for any workflow:

```bash
./workflow-execution-plan.sh nodes/isc/ISC\ -\ GDrive.json
./workflow-execution-plan.sh nodes/isc/ISC\ -\ Scribe.json
```

## References

- [Google Drive Search Files API](https://developers.google.com/drive/api/guides/search-files)
- [Google Drive Files API](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
