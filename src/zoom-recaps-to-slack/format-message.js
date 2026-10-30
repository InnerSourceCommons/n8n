// Resolve names to Slack @-mentions and build the Block Kit recap.
// Mentions are gated to ACTUAL MEMBERS of the target channel: a name is tagged only when
// it resolves to a Slack user who belongs to the channel this recap posts to. That tags every
// attendee who's in the channel (in prose and in action items) and leaves genuinely external
// people plain, and it disambiguates common names for free (e.g. among 9 "Jeff"s in the
// workspace, only the one in the channel gets the ping).
const rec = $('Skip If Already Posted').item.json;
const memberIds = new Set($('Slack: conversations.members').all().flatMap(i => (i.json.members) || []));
const members = $('Slack: users.list').all()
  .flatMap(i => (i.json.members) || [])
  .filter(m => memberIds.has(m.id) && !m.deleted && !m.is_bot && m.id !== 'USLACKBOT');
const norm = x => (x || '').toString().trim().toLowerCase();
// Nickname families: a spelling on the left, when it appears in the text, resolves to a member
// whose first name is the canonical form on the right (lets "Russell" reach the member "Russ").
const ALIAS = { russell: 'russ' };
const canon = f => ALIAS[norm(f)] || norm(f);
const aliasVariants = {}; // canonical -> extra text spellings that should also match
for (const [variant, c] of Object.entries(ALIAS)) (aliasVariants[c] = aliasVariants[c] || []).push(variant);
// Common words that show up in recap prose but are also, occasionally, someone's junk Slack name
// (e.g. a user whose real name is literally "name"). Never treat these as a first name to tag.
const COMMON_WORDS = new Set(['name', 'names', 'team', 'teams', 'board', 'group', 'groups', 'call', 'calls', 'meeting', 'meetings', 'note', 'notes', 'update', 'updates', 'staff', 'work', 'works', 'next', 'step', 'steps', 'item', 'items', 'all', 'new', 'lead', 'leads', 'chair', 'member', 'members', 'working', 'community', 'summit', 'project', 'projects', 'plan', 'plans', 'goal', 'goals', 'review', 'agenda', 'action', 'actions', 'report', 'reports', 'week', 'weeks', 'day', 'days', 'time', 'times', 'page', 'pages', 'doc', 'docs', 'content', 'video', 'videos', 'deck', 'issue', 'issues', 'code', 'user', 'users', 'test', 'admin', 'guest', 'welcome', 'thanks', 'hello']);
const byName = {};   // full "first last" -> id  (channel members only)
const byFirstC = {}; // canonical first name -> Set<id>  (channel members only)
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
// Levenshtein distance, used for a tight fuzzy match against the channel roster.
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
// Fuzzy first-name match within the (small) channel-member pool: catches transcription
// misspellings like "Claire" -> Clare Dillon. Conservative on purpose - only fires for a name
// >=5 chars that is within edit distance 1 of exactly one channel member, so it can't grab a
// common word or pick the wrong person.
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
// Resolve an action-item owner token (may be dotted/underscored, e.g. "Micaela.Eller").
function resolveId(name) {
  const raw = (name || '').trim();
  for (const v of [raw, raw.replace(/[._]+/g, ' ')]) { const id = byName[norm(v)]; if (id) return id; }
  const set = byFirstC[canon(raw.split(/[.\s_]+/)[0])];
  if (set && set.size === 1) return [...set][0];
  return fuzzyFirstId(raw.split(/[.\s_]+/)[0]);
}
// Tag any channel member named anywhere in free text (full names, then unique first names,
// then a tight fuzzy pass over remaining capitalized words for misspelled names).
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
const CH = !!rec.chathamHouse;
// A leading 'Name:' / 'First Last:' owner prefix, dropped on a Chatham House series.
const OWNER_PREFIX = /^[A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,2}$/;
// Action items: resolve the owner token, then tag any members named in the rest of the line.
// Chatham House series: group next steps by owner under anonymous labels (Person 1, Person 2, ...)
// numbered by first appearance, so attendees can still tell which tasks belong together.
let chStepsText = '';
if (CH) {
  const people = new Map();
  const loose = [];
  for (const line of (rec.nextSteps || [])) {
    const s = String(line);
    const j = s.indexOf(':');
    const nm = j > -1 ? s.slice(0, j).trim() : '';
    if (nm && OWNER_PREFIX.test(nm)) {
      const key = resolveId(nm) || canon(nm.split(/[.\s_]+/)[0]);
      if (!people.has(key)) people.set(key, []);
      people.get(key).push(scrub(s.slice(j + 1).trim()));
    } else {
      loose.push(scrub(s.trim()));
    }
  }
  const parts = [];
  let n = 0;
  for (const tasks of people.values()) parts.push('*Person ' + (++n) + '*\n' + tasks.map(t => '• ' + t).join('\n'));
  if (loose.length) parts.push((n ? '*Unassigned*\n' : '') + loose.map(t => '• ' + t).join('\n'));
  if (parts.length) chStepsText = '*Next steps*\n' + parts.join('\n\n');
}
const steps = CH ? [] : (rec.nextSteps || []).map(line => {
  const s = String(line);
  const i = s.indexOf(':');
  if (i === -1) return '• ' + resolveProse(s.trim());
  const nm = s.slice(0, i);
  const id = resolveId(nm);
  const owner = id ? '<@' + id + '>' : '*' + nm.trim() + '*';
  return '• ' + owner + ': ' + resolveProse(s.slice(i + 1).trim());
});
function sectionBlocks(text) {
  const out = []; let cur = '';
  for (const line of (text || '').split('\n')) {
    if ((cur + '\n' + line).length > 2900) { if (cur) out.push({ type: 'section', text: { type: 'mrkdwn', text: cur } }); cur = line; }
    else { cur = cur ? cur + '\n' + line : line; }
  }
  if (cur) out.push({ type: 'section', text: { type: 'mrkdwn', text: cur } });
  return out;
}
const topic = rec.topic || 'Zoom meeting';
// The meeting's start time, formatted in UTC (neutral for the global InnerSource community).
function fmtUTC(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear() + ', ' + h + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' ' + ampm + ' UTC';
}
const when = fmtUTC(rec.meetingStart);
const title = 'Meeting recap - ' + topic + (when ? ' (' + when + ')' : '');
const recap = CH ? scrub(rec.recap || '') : resolveProse(rec.recap || '');
const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: '*:memo: ' + title + '*' } }];
if (recap) blocks.push(...sectionBlocks(recap));
if (steps.length) { blocks.push({ type: 'divider' }); blocks.push(...sectionBlocks('*Next steps*\n' + steps.join('\n'))); }
if (chStepsText) { blocks.push({ type: 'divider' }); blocks.push(...sectionBlocks(chStepsText)); }
if (CH) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: ':lock: Held under the Chatham House Rule - names and affiliations are left out of these notes, and action-item owners are shown as Person 1, Person 2, and so on.' }] });
return [{ json: { channel: rec.channel, meetingUuid: rec.meetingUuid, blocks: blocks.slice(0, 48), fallbackText: title } }];

