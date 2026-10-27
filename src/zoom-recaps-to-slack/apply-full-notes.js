// Take Claude's cleaned full-notes text, resolve member names to @-mentions, chunk into Block Kit.
// Mentions are gated to actual members of the target channel (same rule as the main recap):
// only a name resolving to a channel member is tagged; external names stay plain.
const resp = $json || {};
const src = $('Format Full Notes').item.json;
// Privacy-safe: use only the filter's InnerSource-Commons-only output. If it returned nothing usable
// (filter failed, or nothing ISC-related remained), skip the thread rather than posting raw notes.
let notes = null;
try {
  const t = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  notes = t.trim();
} catch (e) { notes = null; }
if (!notes) return [];
const memberIds = new Set($('Slack: conversations.members').all().flatMap(i => (i.json.members) || []));
const members = $('Slack: users.list').all()
  .flatMap(i => (i.json.members) || [])
  .filter(m => memberIds.has(m.id) && !m.deleted && !m.is_bot && m.id !== 'USLACKBOT');
const norm = x => (x || '').toString().trim().toLowerCase();
const ALIAS = { russell: 'russ' };
const canon = f => ALIAS[norm(f)] || norm(f);
const aliasVariants = {};
for (const [variant, c] of Object.entries(ALIAS)) (aliasVariants[c] = aliasVariants[c] || []).push(variant);
// Common words that show up in notes prose but are also, occasionally, someone's junk Slack name.
const COMMON_WORDS = new Set(['name', 'names', 'team', 'teams', 'board', 'group', 'groups', 'call', 'calls', 'meeting', 'meetings', 'note', 'notes', 'update', 'updates', 'staff', 'work', 'works', 'next', 'step', 'steps', 'item', 'items', 'all', 'new', 'lead', 'leads', 'chair', 'member', 'members', 'working', 'community', 'summit', 'project', 'projects', 'plan', 'plans', 'goal', 'goals', 'review', 'agenda', 'action', 'actions', 'report', 'reports', 'week', 'weeks', 'day', 'days', 'time', 'times', 'page', 'pages', 'doc', 'docs', 'content', 'video', 'videos', 'deck', 'issue', 'issues', 'code', 'user', 'users', 'test', 'admin', 'guest', 'welcome', 'thanks', 'hello']);
const byName = {}, byFirstC = {};
for (const m of members) {
  const p = m.profile || {};
  for (const n of [p.real_name, p.display_name, m.real_name, m.name, p.real_name_normalized, p.display_name_normalized]) {
    const k = norm(n);
    if (k && k.includes(' ') && !(k in byName)) byName[k] = m.id;
  }
  for (const n of [p.real_name, m.real_name, p.display_name, m.name]) {
    const c = canon((n || '').split(/[.\s_]+/)[0]);
    if (c && c.length >= 3 && !COMMON_WORDS.has(c)) (byFirstC[c] = byFirstC[c] || new Set()).add(m.id);
  }
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function fuzzyFirstId(tok) {
  const t = canon(tok);
  if (t.length < 5) return null;
  let hit = null;
  for (const [c, set] of Object.entries(byFirstC)) {
    if (c.length < 5 || set.size !== 1) continue;
    if (lev(t, c) <= 1) { const id = [...set][0]; if (hit && hit !== id) return null; hit = id; }
  }
  return hit;
}
function resolveProse(text) {
  let out = text || '';
  for (const name of Object.keys(byName).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp('\\b' + esc(name) + '\\b', 'gi'), '<@' + byName[name] + '>');
  }
  for (const [c, set] of Object.entries(byFirstC)) {
    if (set.size !== 1) continue;
    const id = [...set][0];
    for (const t of [c, ...(aliasVariants[c] || [])]) out = out.replace(new RegExp('\\b' + esc(t) + '\\b', 'gi'), '<@' + id + '>');
  }
  out = out.replace(/\b[A-Z][a-z]{4,}\b/g, (w) => { const id = fuzzyFirstId(w); return id ? '<@' + id + '>' : w; });
  return out;
}
// Chatham House series: never tag or name a participant. Any channel member's name that survived the
// anonymizing filter is replaced with a neutral stand-in (a backstop - the filter already strips names).
function scrub(text) {
  let out = text || '';
  const anon = (m, poss, at, str) => (/(^|[.!?:*\n]\s*)$/.test(str.slice(0, at)) ? 'A' : 'a') + ' participant' + (poss || '');
  for (const name of Object.keys(byName).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp('\\b' + esc(name) + '(\'s)?\\b', 'gi'), anon);
  }
  for (const c of Object.keys(byFirstC)) {
    for (const t of [c, ...(aliasVariants[c] || [])]) {
      out = out.replace(new RegExp('\\b' + esc(t[0].toUpperCase() + t.slice(1)) + '(\'s)?\\b', 'g'), anon);
    }
  }
  return out;
}
function sectionBlocks(text) {
  const out = []; let cur = '';
  for (const line of (text || '').split('\n')) {
    if ((cur + '\n' + line).length > 2900) { if (cur) out.push({ type: 'section', text: { type: 'mrkdwn', text: cur } }); cur = line; }
    else { cur = cur ? cur + '\n' + line : line; }
  }
  if (cur) out.push({ type: 'section', text: { type: 'mrkdwn', text: cur } });
  return out;
}
notes = src.chathamHouse ? scrub(notes) : resolveProse(notes);
const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*Full notes*' } }].concat(sectionBlocks(notes)).slice(0, 48);
return [{ json: { channel: src.channel, threadTs: src.threadTs, blocks } }];

