# Plan: a weekly DMARC summary

## What DMARC is

DMARC is a DNS record that tells mail providers what to do with mail that claims to be from `innersourcecommons.org` but fails the checks that prove it came from us.
It can also ask the providers to send us a daily report of the servers they saw sending mail as our domain, and whether that mail passed the checks.

We have the record, but it asks for no reports, so we can't see who sends as us.

## The plan

We add a report address to our DMARC record, and a weekly n8n workflow turns the reports into one summary email for Jeff, Raimund, and Russ.

```mermaid
flowchart LR
    P[Gmail, Outlook, Yahoo, ...] -->|daily reports| M[dmarc-reports@ mailbox]
    M -->|every Monday| N[n8n workflow]
    N -->|summary email| G[dmarc@ group:<br/>Jeff, Raimund, Russ]
```

The summary is one table, one row per sender:

| Sender | Messages | Proved it's us | What we'd do |
|---|---|---|---|
| Mailchimp | 1,830 | yes | nothing |
| Google Workspace | 412 | yes | nothing |
| unknown server | 6 | no | check it |

After a few weeks of summaries, we use them to retire the unused mailbox.org records and to tighten DMARC so mail that fails the checks goes to spam.
