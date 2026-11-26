// Read the week's DMARC aggregate reports and build the summary email: one table row per sender.
// A message "proved it's us" when DMARC passed it, meaning DKIM or SPF passed for our domain.
// Only a DKIM signature or SPF check that passed names a sender, so forged mail shows as its server's IP.
// A sender is named by the first of these that its mail has:
// 1. a DKIM signature from our own domain with a selector OWN_SELECTORS lists, named by that list;
// 2. a DKIM signature from another domain, named by KNOWN_SENDERS or else shown as that domain;
// 3. an SPF domain KNOWN_SENDERS names;
// 4. a DKIM signature from our own domain with an unlisted selector, shown with that selector;
// 5. an SPF domain other than ours, shown as that domain;
// 6. otherwise its server's IP address, marked "in our SPF record" when SPF passed for our own domain.
const DOMAIN = 'innersourcecommons.org';
const KNOWN_SENDERS = [
  [/(^|\.)(google\.com|gappssmtp\.com)$/, 'Google Workspace'],
  [/(^|\.)(mcsv\.net|mcdlv\.net|rsgsv\.net|mailchimpapp\.net|mandrillapp\.com)$/, 'Mailchimp'],
  [/(^|\.)mailbox\.org$/, 'mailbox.org'],
];
// Mail signed with our own domain's key is told apart by the DKIM selector that signed it.
const OWN_SELECTORS = { google: 'Google Workspace', k1: 'Mailchimp', k2: 'Mailchimp', k3: 'Mailchimp' };

// Tags may carry attributes or a namespace prefix, as in <dmarc:record xml:lang="en">.
const pattern = (name, flags) => new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`, flags);
const tag = (xml, name) => (xml.match(pattern(name)) || ['', ''])[1].trim();
const all = (xml, name) => [...xml.matchAll(pattern(name, 'g'))].map((m) => m[1]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const known = (domain) => (KNOWN_SENDERS.find(([re]) => re.test(domain)) || [])[1];

function senderOf(record) {
  const auth = tag(record, 'auth_results');
  const passing = (name) => all(auth, name).filter((x) => tag(x, 'result') === 'pass');
  const dkim = passing('dkim').map((d) => ({ domain: tag(d, 'domain').toLowerCase(), selector: tag(d, 'selector').toLowerCase() }));
  const spf = passing('spf').map((s) => tag(s, 'domain').toLowerCase());
  const ip = tag(record, 'source_ip');

  const own = dkim.find((d) => d.domain === DOMAIN && OWN_SELECTORS[d.selector]);
  if (own) return OWN_SELECTORS[own.selector];
  const foreign = dkim.find((d) => d.domain !== DOMAIN);
  if (foreign) return known(foreign.domain) || foreign.domain;
  const spfKnown = spf.map(known).find(Boolean);
  if (spfKnown) return spfKnown;
  if (dkim.length) return `${DOMAIN} (DKIM selector ${dkim[0].selector || 'unknown'})`;
  const other = spf.find((d) => d !== DOMAIN);
  if (other) return other;
  return spf.length ? `server ${ip} (in our SPF record)` : `unknown server ${ip}`;
}

const seen = new Set();
const senders = new Map();
const reporters = new Set();
let unreadable = 0;
function addReport(xml) {
  const id = `${tag(xml, 'org_name')}|${tag(xml, 'report_id')}`;
  if (!tag(xml, 'report_id')) unreadable++;
  if (!tag(xml, 'report_id') || seen.has(id)) return;
  seen.add(id);
  reporters.add(tag(xml, 'org_name'));
  for (const record of all(xml, 'record')) {
    const count = Number(tag(record, 'count')) || 0;
    const policy = tag(record, 'policy_evaluated');
    const passed = tag(policy, 'dkim') === 'pass' || tag(policy, 'spf') === 'pass';
    const name = senderOf(record);
    const s = senders.get(name) || { name, messages: 0, passed: 0 };
    s.messages += count;
    if (passed) s.passed += count;
    senders.set(name, s);
  }
}

const items = $input.all();
for (let i = 0; i < items.length; i++) {
  // Unzip Reports passes on an attachment it couldn't unzip as an item carrying only json.error.
  if (items[i].json.error) unreadable++;
  if (items[i].json.xml) addReport(items[i].json.xml);
  for (const key of Object.keys(items[i].binary || {})) {
    addReport((await this.helpers.getBinaryDataBuffer(i, key)).toString('utf8'));
  }
}

const rows = [...senders.values()].sort((a, b) => b.messages - a.messages);
const n = (x) => x.toLocaleString('en-US');
const proved = (s) => (s.passed === s.messages ? 'yes' : s.passed === 0 ? 'no' : `partly (${n(s.passed)} of ${n(s.messages)})`);
const cell = 'style="border:1px solid #ccc;padding:4px 8px;text-align:left"';
const table = `<table style="border-collapse:collapse">
<tr>${['Sender', 'Messages', "Proved it's us", "What we'd do"].map((h) => `<th ${cell}>${h}</th>`).join('')}</tr>
${rows.map((s) => `<tr><td ${cell}>${esc(s.name)}</td><td ${cell}>${n(s.messages)}</td><td ${cell}>${proved(s)}</td><td ${cell}>${s.passed === s.messages ? 'nothing' : 'check it'}</td></tr>`).join('\n')}
</table>`;

// Get Reports reads mail received over the 7 whole days before today.
const today = $now.startOf('day');
const week = `${today.minus({ days: 7 }).toFormat('LLL d')} - ${today.minus({ days: 1 }).toFormat('LLL d, yyyy')}`;
const unreadNote = unreadable ? `\n<p>Attachments received ${week} that couldn't be read as DMARC reports, left out: ${unreadable}.</p>` : '';
const html = seen.size
  ? `<p>Who sent mail as ${DOMAIN}, from ${seen.size} reports received ${week}, by ${[...reporters].sort().map(esc).join(', ')}.</p>\n${table}${unreadNote}`
  : unreadable
    ? `<p>No DMARC reports for ${DOMAIN} could be read ${week}.</p>${unreadNote}`
    : `<p>No DMARC reports for ${DOMAIN} arrived ${week}.</p>\n<p>Check that the DMARC record still has <code>rua=mailto:dmarc-reports@${DOMAIN}</code>, and that mail to that address reaches the mailbox this workflow reads.</p>`;

return [{ json: { subject: `DMARC weekly summary for ${DOMAIN}: ${week}`, html } }];
