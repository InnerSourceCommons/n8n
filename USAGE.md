# How can I use n8n at the InnerSource Commons?

1. Once n8n's running, you need to sign up for an account.
2. Login to the instance.
3. When looking at workflows that requires secrets you'll be prompted to create a new credential.
  1. To run a workflow with Slack, use InnerSource Commons Bot credentials, [here](https://api.slack.com/apps/A06A2T5C0Q6), ask for an invite to the [#slack-admins](#slack-admins) channel to aquire credentials.
  2. To run a workflow with Google Drive, set up OAuth2 credentials in Google Cloud Console, [here](https://console.cloud.google.com/apis/credentials).
4. Ask in the [#ispo-working-group](#ispo-working-group) for help with this repository.

## Publishing workflows to n8n Cloud

Merging a change to a workflow JSON under `nodes/`, or to one of its Code nodes' files under `src/`, into `main` publishes that workflow to <https://innersourcecommons.app.n8n.cloud/> automatically, through the `Publish workflows to n8n Cloud` GitHub Action.
The Action publishes only the workflows that changed in the push.
Each workflow JSON is matched to its n8n workflow by its `id` field.
Publishing replaces the workflow's name, nodes, connections, settings, and static data, and leaves its active or inactive state as it is.

The Action reads the API key from the `N8N_API_KEY` repository secret.

## Editing a Code node's JavaScript

Each Code node's JavaScript lives only in its own file under `src/`, so a pull request shows a code change as ordinary lines of JavaScript.
In the workflow JSON, the node's code is the one-line comment `// Code comes from src/<path>.js at build time.`, naming that file.
Publishing fills in the real code from the file, through `scripts/update-workflow.sh`, which the GitHub Action and a manual publish both run.
The code runs as the body of an n8n Code node, so a top-level `return` and n8n's built-in globals are valid there even where an editor marks them as errors.

To change a Code node, edit its file under `src/` and commit it.

`make build` writes every workflow with its code filled in to `dist/`, ready to import into an n8n instance by hand.
The `Check Code nodes point at src/` GitHub Action fails a pull request in which a Code node holds code instead of naming a file, names a file that doesn't exist, or a file under `src/` belongs to no Code node; run `make check` to see the same result locally.
On a pull request, the same Action's `preview` job builds what publishing would send to n8n from the pull request and from its base branch, and lists each workflow as identical or names what changed, on the run's summary page.

When a workflow comes from an export of the n8n editor, its Code nodes hold their real code.
Copy the export over the workflow's file under `nodes/` and run `make extract`, which moves each node's code into `src/` and puts the one-line comment back in the JSON.
A new Code node's file is `src/<subfolder under nodes/>/<workflow file name>/<node name>.js`, with each name lowercased and every run of characters other than letters and digits turned into a hyphen.
Extract also removes files under `src/` whose Code node is gone, and stops with an error if publishing would not reproduce the exported code exactly.

## Credential errors (e.g. “does not exist for type …”)

n8n stores credentials by **ID** on the server. If you see `Credential with ID "…" does not exist for type "googleDriveOAuth2Api"` on a node such as **Get All Folders**:

1. Open the workflow in the editor, select that node, and under **Credential** choose an existing **Google Drive OAuth2 API** credential (or create one and connect it).
2. Save the workflow.

Workflow JSON in this repo omits credential IDs where possible so a fresh import asks you to map credentials by name instead of reusing another instance’s IDs.
If your copy still has a bad ID, fix it in the UI as above, or run `make build` and re-import the workflow from `dist/governance/ISC - GDrive.json` and attach your Drive credential when prompted.

**Google Drive + HTTP Request:** Some Google OAuth credentials are configured to **disallow** use inside the **HTTP Request** node (n8n blocks this for security). Workflows such as **ISC - GDrive** use the **Google Drive** node instead so the same APIs run without that restriction.