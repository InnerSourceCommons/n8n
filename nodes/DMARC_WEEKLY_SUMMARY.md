## How It Works

The "DMARC Weekly Summary" workflow emails one summary every Monday of who sent mail as `innersourcecommons.org` over the past week.
It goes to the `dmarc@innersourcecommons.org` group.

Each mail provider that receives our mail sends a daily DMARC report to the address named in our DMARC record, `dmarc-reports@innersourcecommons.org`.
Each Monday the workflow reads the reports received over the 7 days before that Monday, Spam included, unzips them, and adds them up into one table with a row per sender:

| Column | Meaning |
| --- | --- |
| Sender | The service that sent the mail, named from the domain that signed it (DKIM), or else the domain it sent from (SPF). Mail that only passed SPF for our own domain shows as "server" and its IP address, "in our SPF record". Any other mail shows as "unknown server" and its IP address. |
| Messages | How many messages the providers saw from that sender. |
| Proved it's us | "yes" when DMARC passed every message, "no" when it passed none, and "partly" with the counts otherwise. |
| What we'd do | "nothing" for a sender that proved it's us, and "check it" for any other. |

A report that arrives twice is counted once, and an attachment that won't unzip is left out.
A week with no reports still sends an email, saying no reports arrived, so a broken report address shows up within a week.

`summarize-reports.js` names each sender it finds in its `KNOWN_SENDERS` and `OWN_SELECTORS` lists.
To name a new sender, add the domain that signs its mail to `KNOWN_SENDERS`.
For mail signed with our own domain, add the DKIM selector to `OWN_SELECTORS` instead.

## Setup

1. Create the `dmarc@innersourcecommons.org` group in Google Workspace, with Jeff, Raimund, and Russ as members.
2. Make `dmarc-reports@innersourcecommons.org` deliver to a Google Workspace mailbox, as its own user or as an alias of one.
3. In n8n, create a **Gmail OAuth2** credential signed in to that mailbox.
4. Put the credential's id and name in a `credentials` block on both Gmail nodes, **Get Reports** and **Email Summary**, in `nodes/DMARC Weekly Summary.json`, and merge that change.
   Publishing replaces every node, so a credential chosen only in the n8n editor is gone after the next merge.
5. Add the report address to the DMARC record, the `TXT` record at `_dmarc.innersourcecommons.org`:

   ```text
   v=DMARC1; p=none; rua=mailto:dmarc-reports@innersourcecommons.org;
   ```

6. Activate the workflow.
   The first summary goes out on the next Monday; reports start arriving a day or two after the DNS change.

## Credentials

The workflow uses one Gmail OAuth2 credential, both to read the reports and to send the summary.
After Setup step 4, the JSON carries the credential id of the ISC instance, which a different instance won't have; map it to its own credential as described in [USAGE.md](../USAGE.md).
