// Content + cooldown gate. Drop un-generated shells and summaries still being refined.
const s = $json || {};
const cand = $('Attach Fields').item.json;
const COOLDOWN_MIN = 15;
const hasContent = !!(s.summary_overview || (Array.isArray(s.next_steps) && s.next_steps.length));
if (!hasContent) return [];
const modIso = s.summary_last_modified_time || s.summary_created_time;
if (modIso) {
  const ageMin = (Date.now() - new Date(modIso).getTime()) / 60000;
  if (ageMin < COOLDOWN_MIN) return [];
}
return [{ json: {
  meetingUuid: cand.meetingUuid,
  meetingId: cand.meetingId,
  channel: cand.channel,
  chathamHouse: !!cand.chathamHouse,
  topic: s.meeting_topic || cand.topic,
  meetingStart: s.meeting_start_time || cand.meetingStart,
  recap: s.summary_overview || '',
  nextSteps: Array.isArray(s.next_steps) ? s.next_steps : [],
  summaryDetails: Array.isArray(s.summary_details) ? s.summary_details : [],
  docUrl: s.summary_doc_url || '',
}}];
