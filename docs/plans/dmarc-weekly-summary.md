# Plan: a weekly DMARC summary in n8n

## Why

Mail providers send aggregate DMARC reports to whatever address our DMARC record names.
Today `innersourcecommons.org` publishes `v=DMARC1; p=none;` with no report address, so nobody sees them.
Reading them tells us four things:

- **Who sends as our domain.**
  Every service that sends as `innersourcecommons.org`, and whether each passes SPF and DKIM.
- **Whether anyone forges it.**
  Mail from servers we don't recognize that fails both checks.
- **Whether mailbox.org still sends.**
  Reports cover only mail delivered to providers that send them, which includes the large ones.
  Four quiet weeks are good enough evidence to remove its SPF include and the `MBO0001`-`MBO0004` DKIM records.
- **When DMARC can be tightened.**
  Once every real sender passes, we move `p=none` to `p=quarantine`.

The raw reports are compressed XML (`.zip` or `.gz`), one per provider per day, so this plan has n8n turn them into one readable email a week.
It runs on ISC's n8n Cloud instance, which is always on, and the report data stays in ISC's own Google Workspace and n8n.

## What the weekly email looks like

One row per sender, busiest first (sample numbers):

| Sender | Messages | Proved it's us | What we'd do |
|---|---|---|---|
| Mailchimp | 1,830 | yes | nothing |
| Google Workspace | 412 | yes | nothing |
| 203.0.113.7 (unknown) | 6 | no | check it: forgery, or forwarded mail |
| mailbox.org | not seen | - | remove its records after 4 quiet weeks |

"Proved it's us" means the message passed DMARC: an SPF or DKIM pass on a domain aligned with `innersourcecommons.org`.
A sender with a mix of passes and fails shows the split.
Reports list only servers that sent mail, so the workflow keeps a short list of the senders we expect and shows any of them that sent nothing that week as "not seen".
The email also lists which providers reported that week and how many reports arrived.

## How it works

The work splits into a mailbox, a group, and one weekly workflow:

1. **Reports land in a role mailbox.**
   We create a Workspace user `dmarc-reports@innersourcecommons.org`, owned by the foundation rather than any one person, and set the DMARC record to `rua=mailto:dmarc-reports@innersourcecommons.org`.
   An address on our own domain needs no extra authorization record.
   Its password goes in the ISC Accounts sheet like every other service account.
2. **The summary goes to the `dmarc@` group.**
   That group holds Jeff, Raimund, and Russ, and it receives the weekly email and any failure alert, never the raw reports.
3. **n8n reads the mailbox once a week.**
   A schedule trigger runs Monday at 8:00 AM `America/Chicago`.
   A Gmail node, signed in as `dmarc-reports@`, fetches every report not yet labeled `processed`, so a missed week is caught up on the next run.
4. **n8n unpacks and parses each report.**
   The built-in Compression node unpacks the attachment, Extract from File turns it into text, and the XML node turns that into JSON.
   A Code node flattens each report into one row per sending server and names the sender from its DKIM signing domain.
   A server with no usable signing domain is named by its reverse DNS, looked up through an HTTP Request node to a public DNS-over-HTTPS service, since n8n Cloud Code nodes can't load Node's `dns` module.
5. **History is kept in an n8n data table.**
   Each row records the reporting provider, report ID, date range, sending IP, sender name, message count, and the SPF and DKIM results.
   The workflow skips a report whose provider and report ID it already holds, so a report is never counted twice.
   n8n Cloud caps all data tables on an instance at 50 MB together; a year of rows at our volume is a small fraction of that, and each weekly run deletes rows older than 13 months.
   The original report emails stay in the mailbox as the source of record.
6. **n8n sends the summary and labels the reports.**
   The email goes from `dmarc-reports@` to `dmarc@`, and each processed report gets the `processed` label.

## How we notice when it stops

Three signals cover a stalled job or a stop in reports:

- **Empty weeks say so.**
  A week with no reports says so in the subject line, so silence never looks like a clean week.
- **Failed runs email us.**
  An n8n error workflow emails `dmarc@` when a run fails.
- **A missing email is noticed.**
  All three of us expect it every Monday.

## Where it lives

Each piece has one home:

- **The workflow:** `nodes/DMARC Weekly Summary.json` in this repo, with its Code node in `src/dmarc-weekly-summary/`.
  Merging to `main` publishes it to n8n Cloud, as for the other workflows here.
- **The DMARC record change:** a merge request to `dns/records.tf` in the [ISC infrastructure project](https://gitlab.com/innersourcecommons/infrastructure), reviewed by Raimund and Jeff.
- **The run cost:** about five executions a month, well inside any n8n Cloud plan.

## Order of work

1. Create the `dmarc-reports@` mailbox and its `processed` label, and let it post to `dmarc@`.
2. Open the merge request that adds the `rua` address; reports start arriving within a day or two of the apply.
3. Build the workflow by pull request here and run it once by hand against the first few days of reports.
4. After four weeks of summaries, decide on removing the mailbox.org records, then on `p=quarantine`, each as its own merge request.

[parsedmarc](https://github.com/domainaware/parsedmarc) is the reference for the report format and for which fields matter.

## Questions for Jeff and Raimund

Two choices are open for you:

- **A separate role mailbox.**
  Does it suit you that the raw reports go to `dmarc-reports@`, with `dmarc@` carrying the summary and alerts?
- **The send time.**
  Is Monday 8:00 AM Central a good time for the email?
