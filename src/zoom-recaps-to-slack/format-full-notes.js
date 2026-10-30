// Build the raw full-notes text from Zoom's detailed sections, plus the main post's thread ts.
const rec = $('Apply Filter').item.json;
const details = rec.summaryDetails || [];
const channel = $('Format Message').item.json.channel;
const post = $('Slack: chat.postMessage').item.json;
const ts = post && post.ts;
if (!details.length || !ts) return [];
const notesText = details
  .map(d => '*' + (d.label || '').toString().trim() + '*\n' + (d.summary || '').toString().trim())
  .join('\n\n');
return [{ json: { channel, threadTs: ts, notesText, chathamHouse: !!rec.chathamHouse } }];

