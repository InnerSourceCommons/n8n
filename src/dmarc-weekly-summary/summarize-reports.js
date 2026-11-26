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

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*</${name}>`));
  return m ? m[1] : '';
};
const all = (xml, name) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function senderOf(record) {
  const auth = tag(record, 'auth_results');
  const dkim = all(auth, 'dkim').map((d) => ({ domain: tag(d, 'domain').toLowerCase(), selector: tag(d, 'selector').toLowerCase() }));
  const spf = all(auth, 'spf').map((s) => tag(s, 'domain').toLowerCase());
  for (const d of dkim) {
    if (d.domain === DOMAIN) {
      if (OWN_SELECTORS[d.selector]) return OWN_SELECTORS[d.selector];
      continue;
    }
    const known = KNOWN_SENDERS.find(([re]) => re.test(d.domain));
    return known ? known[1] : d.domain;
  }
  for (const domain of spf) {
    const known = KNOWN_SENDERS.find(([re]) => re.test(domain));
    if (known) return known[1];
  }
  if (dkim.length) return `${DOMAIN} (DKIM selector ${dkim[0].selector || 'unknown'})`;
  return spf[0] && spf[0] !== DOMAIN ? spf[0] : `unknown server ${tag(record, 'source_ip')}`;
}

const texts = [];
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  if (items[i].json.xml) texts.push(items[i].json.xml);
  for (const key of Object.keys(items[i].binary || {})) {
    texts.push((await this.helpers.getBinaryDataBuffer(i, key)).toString('utf8'));
  }
}

const seen = new Set();
const senders = new Map();
const reporters = new Set();
for (const xml of texts) {
  const id = `${tag(xml, 'org_name')}|${tag(xml, 'report_id')}`;
  if (!tag(xml, 'report_id') || seen.has(id)) continue;
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

const rows = [...senders.values()].sort((a, b) => b.messages - a.messages);
const proved = (s) => (s.passed === s.messages ? 'yes' : s.passed === 0 ? 'no' : `partly (${s.passed.toLocaleString('en-US')} of ${s.messages.toLocaleString('en-US')})`);
const cell = 'style="border:1px solid #ccc;padding:4px 8px;text-align:left"';
const table = `<table style="border-collapse:collapse">
<tr>${['Sender', 'Messages', "Proved it's us", "What we'd do"].map((h) => `<th ${cell}>${h}</th>`).join('')}</tr>
${rows.map((s) => `<tr><td ${cell}>${esc(s.name)}</td><td ${cell}>${s.messages.toLocaleString('en-US')}</td><td ${cell}>${proved(s)}</td><td ${cell}>${s.passed === s.messages ? 'nothing' : 'check it'}</td></tr>`).join('\n')}
</table>`;

const week = `${$now.minus({ days: 7 }).toFormat('LLL d')} - ${$now.minus({ days: 1 }).toFormat('LLL d, yyyy')}`;
const html = seen.size
  ? `<p>Who sent mail as ${DOMAIN}, ${week}, from ${seen.size} reports by ${[...reporters].sort().map(esc).join(', ')}.</p>\n${table}`
  : `<p>No DMARC reports arrived for ${DOMAIN}, ${week}.</p>\n<p>Check that the DMARC record still has <code>rua=mailto:dmarc-reports@${DOMAIN}</code>, and that mail to that address reaches the mailbox this workflow reads.</p>`;

return [{ json: { subject: `DMARC weekly summary for ${DOMAIN}: ${week}`, html } }];
