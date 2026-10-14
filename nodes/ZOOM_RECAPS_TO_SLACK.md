## How It Works

The "Zoom Recaps to Slack" workflow posts each finished Zoom meeting's AI Companion recap and action items into the Slack channel for that meeting series.
Each action item's assignee becomes a real Slack `@`-mention, and a name that can't be matched stays plain text.
Recaps post to the team channel automatically.

The workflow has two ways in, and both feed one shared posting path:

1. **Webhook**: Zoom calls the workflow when a meeting's summary finishes, and the recap posts about 20 minutes later, so the summary has finished settling.
2. **Daily sweep**: a Schedule Trigger runs each morning, asks Zoom for the previous day's meeting summaries, and posts anything the webhook missed.
   Zoom's summary webhook sometimes doesn't fire, and the sweep covers those misses.

Both paths post only meetings listed in the Config table below.

### Data tables

Three n8n Data tables hold the workflow's state.
Their contents live in n8n.

| Table | Purpose |
| --- | --- |
| Config | One row per recurring Zoom meeting ID, giving its Slack channel and a `chathamHouse` checkbox. A meeting whose ID isn't in the table is ignored. |
| Posted | The meeting instances already posted, keyed by each occurrence's unique ID, so a recap posts exactly once however many times the workflow runs over it. |
| Zoom Recaps - Webhook Secret | One row, column `secretToken`: the secret token of the Zoom app's Event Subscription. |

Adding a meeting series is adding a Config row; the workflow itself doesn't change.
Checking `chathamHouse` on a row posts that series under the Chatham House Rule: a filter pass removes every name and affiliation, next steps are grouped under "Person 1", "Person 2" and so on, and nobody is `@`-mentioned.

### Webhook checks

Every call to the webhook is checked before anything else runs:

- **Validation challenge answered:** Zoom's endpoint URL validation gets the HMAC of its challenge token, which proves the workflow holds the subscription's secret token.
- **Signature required:** every other call must carry a valid `x-zm-signature` (the HMAC of the request timestamp and raw body).
  A call without one gets a 401 and stops.
- **200 reply first:** Zoom gets its reply within its three-second limit, before the wait and the posting begin.
- **Only configured summaries proceed:** only a "summary completed" event for a meeting in the Config table goes on to the posting path.

The secret token sits in a Data table because this n8n plan has no Variables feature and Code nodes can't read credentials.

## Zoom setup

The webhook comes from an Event Subscription on the "ISC Zoom Recaps to Slack" Server-to-Server OAuth app in the Zoom Marketplace.

1. Open the app's **Feature** tab and turn on **Event Subscriptions**.
2. Add a subscription with the endpoint URL set to the workflow's **production** webhook URL (the Webhook node's Production URL in n8n), and subscribe to **Meeting summary has been completed**.
3. Copy the subscription's **Secret Token** into the `secretToken` cell of the "Zoom Recaps - Webhook Secret" Data table.
4. Click **Validate** in Zoom.
   The workflow answers the validation challenge using the stored token.

When the secret token is regenerated in Zoom, paste the new value into the same cell.

## Credentials

The workflow uses the Slack bot credential, a header-auth credential for the Claude filter calls, and a basic-auth credential for Zoom's Server-to-Server token.
The JSON carries the credential ids of the ISC instance, which a different instance won't have; map them to its own credentials as described in [USAGE.md](../USAGE.md).

## Loading a change into n8n

The workflow's n8n id is `pLIk4d8AYwAmpxpz`.
After a change to `Zoom Recaps to Slack.json` merges, load it with:

```bash
N8N_API_KEY=<your key> ./scripts/update-workflow.sh "nodes/Zoom Recaps to Slack.json"
```

The script sends the file to the n8n public API with a PUT.
Check in the editor that the workflow is still active afterwards.
