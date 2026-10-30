// Config Lookup produced the channel row (or nothing => not in allowlist, drop).
const channel = $json.channel;
if (!channel) return [];
const cand = $('Build Candidates').item.json;
return [{ json: { ...cand, channel } }];
