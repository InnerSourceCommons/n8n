// Pick the one meeting to post this run: the newest UNPOSTED occurrence of any configured meeting
// (on a webhook run, of the triggering meeting only) whose summary is ready to post (see readyToPost). An occurrence with nothing to post - a room started
// and stopped in seconds, a summary Zoom never generated, a failed fetch - is skipped, never allowed to
// block the occurrences behind it. Calendar guardrail: a meeting headed for a PUBLIC channel
// must match a scheduled public-calendar event (same Zoom meeting id + weekday/time) - this stops a
// different meeting that borrowed the same Zoom room (e.g. a board meeting) from posting to a public
// channel. Meetings headed for PRIVATE channels post without that check. Emits 0 or 1 item.
const token = $('Get Zoom Token').first().json.access_token;

const config = {};
const chatham = {};
for (const r of $('All Config').all()) { const j = r.json || {}; if (j.meetingId) { config[String(j.meetingId)] = j.channel; chatham[String(j.meetingId)] = j.chathamHouse === true; } }
const posted = new Set($('All Posted').all().map(r => (r.json || {}).occurrenceUuid).filter(Boolean));

// Channel privacy from the conversations.list side fetch; default to private (safe) if unknown.
const chans = $('Slack: conversations.list').all().flatMap(i => (i.json.channels) || []);
const isPrivateChannel = (name) => { const c = chans.find(x => '#' + x.name === name); return c ? !!c.is_private : true; };

// Public-calendar iCal text (fetched upstream, no auth).
const j = $('Public Calendar').first().json;
const ical = (j && (j.data || (typeof j === 'string' ? j : j.body))) || '';
function matchesPublicEvent(icalText, meetingId, occurrenceIso) {
  const text = (icalText || '').replace(/\r?\n[ \t]/g, ''); // unfold continuation lines
  const events = text.split('BEGIN:VEVENT').slice(1);
  const occ = new Date(occurrenceIso);
  const occDate = occurrenceIso.slice(0, 10).replace(/-/g, '');
  const occWeekday = occ.getUTCDay();
  const occMin = occ.getUTCHours() * 60 + occ.getUTCMinutes();
  for (const e of events) {
    if (!e.includes(String(meetingId))) continue;
    const dt = (e.match(/DTSTART[^:]*:([0-9T]+Z?)/) || [])[1];
    if (!dt) continue;
    if (dt.slice(0, 8) === occDate) return true; // concrete instance on the same date
    if (/Z$/.test(dt)) {                          // recurring UTC slot: match weekday + time-of-day
      const h = +dt.slice(9, 11), mi = +dt.slice(11, 13);
      const evd = new Date(Date.UTC(+dt.slice(0, 4), +dt.slice(4, 6) - 1, +dt.slice(6, 8), h, mi));
      if (evd.getUTCDay() === occWeekday && Math.abs((h * 60 + mi) - occMin) <= 90) return true;
    }
  }
  return false;
}

// Flatten every summary across the paginated List Summaries responses.
const all = [];
for (const it of $('List Summaries').all()) for (const s of (((it.json || {}).summaries) || [])) all.push(s);

// A webhook run handles only the meeting that triggered it, so two meetings finishing close together
// don't race for the same run. Verify Zoom only has output on the webhook path; the daily sweep never
// executes it, so reading it there throws and the sweep keeps considering every configured meeting.
let trigger = null;
try { trigger = $('Verify Zoom').first().json; } catch (e) { trigger = null; }
const triggerId = trigger && trigger.meetingId ? String(trigger.meetingId) : '';
const triggerUuid = trigger && trigger.meetingUuid ? String(trigger.meetingUuid) : '';

// Every unposted occurrence of a configured meeting, newest first.
let eligible = all
  .filter(s => config[String(s.meeting_id)] && !posted.has(s.meeting_uuid))
  .filter(s => !triggerId || String(s.meeting_id) === triggerId)
  .sort((a, b) => new Date(b.meeting_start_time) - new Date(a.meeting_start_time));
// Prefer the exact occurrence that triggered the webhook; if the list doesn't show it yet, fall back to
// the newest unposted occurrence of the same meeting.
if (triggerUuid && eligible.some(s => s.meeting_uuid === triggerUuid)) eligible = eligible.filter(s => s.meeting_uuid === triggerUuid);

// Same test as the Gate (content present, summary not still being refined), asked here so an
// occurrence that fails it is passed over instead of ending the run. Any fetch error counts as not ready.
const COOLDOWN_MIN = 15;
const readyToPost = async (s) => {
  try {
    const d = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://api.zoom.us/v2/meetings/' + encodeURIComponent(encodeURIComponent(s.meeting_uuid)) + '/meeting_summary',
      headers: { Authorization: 'Bearer ' + token },
      json: true,
    });
    if (!(d.summary_overview || (Array.isArray(d.next_steps) && d.next_steps.length))) return false;
    const modIso = d.summary_last_modified_time || d.summary_created_time;
    return !modIso || (Date.now() - new Date(modIso).getTime()) / 60000 >= COOLDOWN_MIN;
  } catch (e) { return false; }
};

// Pick the newest that clears the guardrail and is ready.
let chosen = null;
for (const s of eligible) {
  const channel = config[String(s.meeting_id)];
  // public channel + no matching public event -> a room-reuse; skip it, try the next.
  if (!isPrivateChannel(channel) && !matchesPublicEvent(ical, s.meeting_id, s.meeting_start_time)) continue;
  if (await readyToPost(s)) { chosen = s; break; }
}
if (!chosen) return [];

return [{ json: {
  meetingUuid: chosen.meeting_uuid,
  meetingId: String(chosen.meeting_id),
  topic: chosen.meeting_topic,
  meetingStart: chosen.meeting_start_time,
  channel: config[String(chosen.meeting_id)],
  chathamHouse: !!chatham[String(chosen.meeting_id)],
  occurrenceUuid: chosen.meeting_uuid,
  token,
}}];

