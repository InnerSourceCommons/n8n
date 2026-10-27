# How can I use n8n at the InnerSource Commons?

1. Once n8n's running, you need to sign up for an account.
2. Login to the instance.
3. When looking at workflows that requires secrets you'll be prompted to create a new credential.
  1. To run a workflow with Slack, use InnerSource Commons Bot credentials, [here](https://api.slack.com/apps/A06A2T5C0Q6), ask for an invite to the [#slack-admins](#slack-admins) channel to aquire credentials.
  2. To run a workflow with Google Drive, set up OAuth2 credentials in Google Cloud Console, [here](https://console.cloud.google.com/apis/credentials).
4. Ask in the [#ispo-working-group](#ispo-working-group) for help with this repository.

## Publishing workflows to n8n Cloud

Merging a change to a workflow JSON under `nodes/` into `main` publishes it to <https://innersourcecommons.app.n8n.cloud/> automatically, through the `Publish workflows to n8n Cloud` GitHub Action.
The Action publishes only the workflow files that changed in the push.
Each file is matched to its workflow by the `id` field in the JSON.
Publishing replaces the workflow's name, nodes, connections, settings, and static data, and leaves its active or inactive state as it is.

The Action reads the API key from the `N8N_API_KEY` repository secret.

## Editing a Code node's JavaScript

Each Code node's JavaScript lives in its own file under `src/`, so a pull request shows a code change as ordinary lines of JavaScript.
A Code node's file is `src/<subfolder under nodes/>/<workflow file name>/<node name>.js`, with each name lowercased and every run of other characters turned into a hyphen.
The code runs as the body of an n8n Code node, so a top-level `return` and n8n's built-in globals are valid there even where an editor marks them as errors.

To change a Code node:

1. Edit its file under `src/`.
2. Run `make build` (or `node scripts/code-nodes.js build`), which writes the code into the workflow JSON under `nodes/` and changes only the edited node's `jsCode` line.
3. Commit both the `.js` file and the workflow JSON.

The workflow JSON stays committed because it is what publishing sends to n8n Cloud.
The `Check Code-node source matches workflow JSON` GitHub Action fails a pull request whose workflow JSON differs from what `make build` writes from `src/`; run `make check` to see the same result locally.

When a workflow comes from an export of the n8n editor, or gains, loses, or renames a Code node, run `make extract` to rewrite `src/` from the workflow JSON.
Extract writes one file per Code node, removes files whose node is gone, and stops with an error if building from those files would not reproduce the workflow JSON byte for byte.

## Credential errors (e.g. “does not exist for type …”)

n8n stores credentials by **ID** on the server. If you see `Credential with ID "…" does not exist for type "googleDriveOAuth2Api"` on a node such as **Get All Folders**:

1. Open the workflow in the editor, select that node, and under **Credential** choose an existing **Google Drive OAuth2 API** credential (or create one and connect it).
2. Save the workflow.

Workflow JSON in this repo omits credential IDs where possible so a fresh import asks you to map credentials by name instead of reusing another instance’s IDs. If your copy still has a bad ID, fix it in the UI as above, or re-import the workflow from `nodes/working-group-roles/ISC - GDrive.json` and attach your Drive credential when prompted.

**Google Drive + HTTP Request:** Some Google OAuth credentials are configured to **disallow** use inside the **HTTP Request** node (n8n blocks this for security). Workflows such as **ISC - GDrive** use the **Google Drive** node instead so the same APIs run without that restriction.