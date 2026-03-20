# How can I use n8n at the InnerSource Commons?

1. Once n8n's running, you need to sign up for an account.
2. Login to the instance.
3. When looking at workflows that requires secrets you'll be prompted to create a new credential.
  1. To run a workflow with Slack, use InnerSource Commons Bot credentials, [here](https://api.slack.com/apps/A06A2T5C0Q6), ask for an invite to the [#slack-admins](#slack-admins) channel to aquire credentials.
  2. To run a workflow with Google Drive, set up OAuth2 credentials in Google Cloud Console, [here](https://console.cloud.google.com/apis/credentials).
4. Ask in the [#ispo-working-group](#ispo-working-group) for help with this repository.

## Credential errors (e.g. “does not exist for type …”)

n8n stores credentials by **ID** on the server. If you see `Credential with ID "…" does not exist for type "googleDriveOAuth2Api"` on a node such as **Get All Folders**:

1. Open the workflow in the editor, select that node, and under **Credential** choose an existing **Google Drive OAuth2 API** credential (or create one and connect it).
2. Save the workflow.

Workflow JSON in this repo omits credential IDs where possible so a fresh import asks you to map credentials by name instead of reusing another instance’s IDs. If your copy still has a bad ID, fix it in the UI as above, or re-import the workflow from `nodes/working-group-roles/ISC - GDrive.json` and attach your Drive credential when prompted.

**Google Drive + HTTP Request:** Some Google OAuth credentials are configured to **disallow** use inside the **HTTP Request** node (n8n blocks this for security). Workflows such as **ISC - GDrive** use the **Google Drive** node instead so the same APIs run without that restriction.