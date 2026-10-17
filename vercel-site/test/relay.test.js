import test from 'node:test';
import assert from 'node:assert/strict';
import { relay, MAX_BODY } from '../lib/relay.js';
const base = { method: 'GET', path: 'deployment', host: 'ghostpay.vercel.app' };
test('only fixed upstream API paths can be proxied', async () => {
  for (const path of ['https://evil.example', '../admin', '/health', 'requests/../health', ['health', 'deployment']]) {
    const response = await relay({ ...base, path }, () => { throw new Error('Must not fetch'); }); assert.equal(response.status, 404);
  }
});
test('POST verifies browser origin and enforces JSON and size bounds', async () => {
  const input = { ...base, method: 'POST', path: 'requests', origin: 'https://ghostpay.vercel.app', contentType: 'application/json', body: Buffer.from('{}') };
  assert.equal((await relay({ ...input, origin: 'https://evil.example' })).status, 403);
  assert.equal((await relay({ ...input, contentType: 'text/plain' })).status, 415);
  assert.equal((await relay({ ...input, body: Buffer.alloc(MAX_BODY + 1) })).status, 413);
});
test('wallet-signed JSON is preserved and upstream gets its own origin', async () => {
  const body = Buffer.from(JSON.stringify({ signature: '0x1234', paymentId: '1' }));
  const response = await relay({ ...base, path: 'requests', method: 'POST', origin: 'https://ghostpay.vercel.app', contentType: 'application/json', body }, async (url, options) => {
    assert.equal(url, 'https://ghostpay-prem-sepolia.brawnyfrost16.chatgpt.site/api/requests');
    assert.equal(options.headers.Origin, new URL(url).origin); assert.deepEqual(options.body, body);
    return Response.json({ error: 'Invalid signature.' }, { status: 403 });
  });
  assert.equal(response.status, 403); assert.equal(JSON.parse(response.body).error, 'Invalid signature.');
});
test('non-JSON upstream responses and network failures become actionable errors', async () => {
  assert.equal((await relay(base, async () => new Response('<html>Gateway error</html>'))).status, 502);
  assert.equal((await relay(base, async () => { throw new Error('offline'); })).status, 502);
});
