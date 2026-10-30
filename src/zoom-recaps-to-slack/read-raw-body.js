// Zoom signs the exact bytes it sent, so keep the raw request body alongside the parsed one.
// (The Webhook node's Raw Body option stores those bytes as the binary property "data".)
const raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
return [{ json: { headers: $json.headers || {}, body: $json.body || {}, raw } }];

