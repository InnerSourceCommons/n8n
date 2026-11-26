// Read the week's DMARC aggregate reports and build the summary email: one table row per sender.
// A message "proved it's us" when DMARC passed it, meaning DKIM or SPF passed for our domain.
// A sender is named by the domain that signed its mail (DKIM), or else the domain it sent from (SPF);
// KNOWN_SENDERS turns the domains we recognize into a name, and mail with neither is grouped by server IP.
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
  const dkim = all(auth, 'dkim').map((d) => ({ domain: tag(d, 'domain').toLowerCase(), selector: tag(d, 'selector').toLowerCase() }));
  const spf = all(auth, 'spf').map((s) => ({ domain: tag(s, 'domain').toLowerCase(), result: tag(s, 'result') }));
  const ip = tag(record, 'source_ip');

  const own = dkim.find((d) => d.domain === DOMAIN && OWN_SELECTORS[d.selector]);
  if (own) return OWN_SELECTORS[own.selector];
  const foreign = dkim.find((d) => d.domain !== DOMAIN);
  if (foreign) return known(foreign.domain) || foreign.domain;
  const spfKnown = spf.map((s) => known(s.domain)).find(Boolean);
  if (spfKnown) return spfKnown;
  if (dkim.length) return `${DOMAIN} (DKIM selector ${dkim[0].selector || 'unknown'})`;
  const other = spf.find((s) => s.domain !== DOMAIN);
  if (other) return other.domain;
  return spf.some((s) => s.result === 'pass') ? `server ${ip} (in our SPF record)` : `unknown server ${ip}`;
}

const seen = new Set();
const senders = new Map();
const reporters = new Set();
function addReport(xml) {
  const id = `${tag(xml, 'org_name')}|${tag(xml, 'report_id')}`;
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
const html = seen.size
  ? `<p>Who sent mail as ${DOMAIN}, from ${seen.size} reports received ${week}, by ${[...reporters].sort().map(esc).join(', ')}.</p>\n${table}`
  : `<p>No DMARC reports for ${DOMAIN} arrived ${week}.</p>\n<p>Check that the DMARC record still has <code>rua=mailto:dmarc-reports@${DOMAIN}</code>, and that mail to that address reaches the mailbox this workflow reads.</p>`;

return [{ json: { subject: `DMARC weekly summary for ${DOMAIN}: ${week}`, html } }];
