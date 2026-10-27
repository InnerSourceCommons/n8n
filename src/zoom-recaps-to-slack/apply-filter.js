// Replace recap + nextSteps with the InnerSource-Commons-only cleaned versions from the filter.
// Privacy-safe: if the filter didn't return a usable result, SKIP posting rather than falling back
// to the raw (unfiltered) summary. And if nothing ISC-related survived, there is nothing to post.
const resp = $json || {};
const rec = $('Gate').item.json;
let recap = null, nextSteps = null;
try {
  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    const parsed = JSON.parse(m[0]);
    if (typeof parsed.recap === 'string') recap = parsed.recap;
    if (Array.isArray(parsed.nextSteps)) nextSteps = parsed.nextSteps;
  }
} catch (e) {}
if (recap === null || nextSteps === null) return [];
recap = recap.trim();
if (!recap && nextSteps.length === 0) return [];
return [{ json: { ...rec, recap, nextSteps } }];

