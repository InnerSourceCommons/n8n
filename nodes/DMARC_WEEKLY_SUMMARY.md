## How It Works

The "DMARC Weekly Summary" workflow emails one summary every Monday of who sent mail as `innersourcecommons.org` over the past week.
It goes to the `dmarc@innersourcecommons.org` group.

Mail providers such as Gmail and Outlook send a daily DMARC report to the address named in our DMARC record, `dmarc-reports@innersourcecommons.org`.
Each Monday the workflow reads the last 7 days of those reports, unzips them, and adds them up into one table with a row per sender:

| Column | Meaning |
| --- | --- |
| Sender | The service that sent the mail, named from the domain that signed it (DKIM), or else the domain it sent from (SPF). Mail with neither shows as "unknown server" and its IP address. |
| Messages | How many messages the providers saw from that sender. |
| Proved it's us | "yes" when DMARC passed every message, "no" when it passed none, and "partly" with the counts otherwise. |
| What we'd do | "nothing" for a sender that proved it's us, and "check it" for any other. |

A report that arrives twice is counted once.
A week with no reports still sends an email, saying no reports arrived, so a broken report address shows up within a week.

`summarize-reports.js` names the senders it recognizes, such as Google Workspace, Mailchimp, and mailbox.org.
A sender it doesn't recognize shows as its domain; to give it a name, add its domain to `KNOWN_SENDERS` in that file.

## Setup

1. Create the `dmarc@innersourcecommons.org` group in Google Workspace, with Jeff, Raimund, and Russ as members.
2. Make `dmarc-reports@innersourcecommons.org` deliver to a Google Workspace mailbox, as its own user or as an alias of one.
3. In n8n, create a **Gmail OAuth2** credential signed in to that mailbox, and choose it on both the **Get Reports** and **Email Summary** nodes.
4. Add the report address to the DMARC record, the `TXT` record at `_dmarc.innersourcecommons.org`:

   ```text
   v=DMARC1; p=none; rua=mailto:dmarc-reports@innersourcecommons.org;
   ```

5. Activate the workflow.
   The first summary goes out on the next Monday; reports start arriving a day or two after the DNS change.

## Credentials

The workflow uses one Gmail OAuth2 credential, both to read the reports and to send the summary.
The JSON carries no credential ids, so a fresh import asks for the credential by name, as described in [USAGE.md](../USAGE.md).
