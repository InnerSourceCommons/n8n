// Decide how to answer Zoom, and whether this call should go on to post a recap.
// - endpoint.url_validation: prove we hold the app's secret token by returning the HMAC of plainToken.
// - anything else must carry a valid x-zm-signature (HMAC of "v0:<timestamp>:<raw body>"), so only
//   Zoom can trigger a post; a bad or missing signature gets a 401 and stops here.
// - only meeting.summary_completed goes on to the posting path.
// Zoom wants the answer within 3 seconds, so this node only decides; the slow work runs after the reply.
const crypto = require('crypto');
const req = $('Read Raw Body').first().json;
const secret = String(($('Webhook Secret').first().json || {}).secretToken || '').trim();
const hmac = (msg) => crypto.createHmac('sha256', secret).update(msg).digest('hex');
const body = req.body || {};
const event = body.event || '';

if (!secret) return [{ json: { status: 500, response: { error: 'webhook secret not configured' }, proceed: false } }];

if (event === 'endpoint.url_validation') {
  const plainToken = String((body.payload || {}).plainToken || '');
  return [{ json: { status: 200, response: { plainToken, encryptedToken: hmac(plainToken) }, proceed: false } }];
}

const sent = String(req.headers['x-zm-signature'] || '');
const expected = 'v0=' + hmac('v0:' + (req.headers['x-zm-request-timestamp'] || '') + ':' + req.raw);
const valid = sent.length === expected.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
if (!valid) return [{ json: { status: 401, response: { error: 'invalid signature' }, proceed: false } }];

const obj = (body.payload || {}).object || {};
return [{ json: {
  status: 200,
  response: { ok: true },
  proceed: event === 'meeting.summary_completed',
  meetingId: String(obj.meeting_id || obj.id || ''),
  meetingUuid: obj.meeting_uuid || obj.uuid || '',
} }];

