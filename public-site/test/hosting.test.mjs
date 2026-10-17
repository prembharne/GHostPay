import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { encodeFunctionResult } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import worker from '../dist/server/index.js';
import { RequestStore } from '../worker/store.js';
import { escrowAbi } from '../shared/abi.ts';
import { requestMessage } from '../shared/protocol.ts';
import deployment from '../deployment.json' with { type: 'json' };

function database() {
  const db = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter(x => x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  return { db, prepare(sql) { return { bind(...args) { const query = db.prepare(sql); return {
    async first() { return query.get(...args) || null; }, async all() { return { results: query.all(...args) }; }, async run() { return query.run(...args); },
  }; } }; } };
}
const ctx = { waitUntil(promise) { promise.catch(() => {}); } };
const request = (path, input) => new Request('https://ghostpay.example' + path, input ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://ghostpay.example' }, body: JSON.stringify(input) } : {});

test('shared storage survives new relay instances, deduplicates recipient casing, and isolates deployments', async () => {
  const DB = database(); const first = new RequestStore(DB, deployment);
  const account = privateKeyToAccount(generatePrivateKey());
  const a = await first.create('1', account.address);
  const second = new RequestStore(DB, deployment);
  const b = await second.create('1', account.address.toLowerCase());
  assert.equal(a.id, b.id); assert.equal((await second.list('1')).length, 1);
  const other = new RequestStore(DB, { ...deployment, address: '0x0000000000000000000000000000000000000001' });
  assert.equal(await other.get(a.id), null); assert.deepEqual(await other.list('1'), []);
  DB.db.close();
});
test('atomic version check prevents stale approvals/rejections from overwriting each other', async () => {
  const DB = database(); const store = new RequestStore(DB, deployment);
  const record = await store.create('1', '0x0000000000000000000000000000000000000001');
  const outcomes = await Promise.allSettled([store.update(record, 'authorized', '9999999999', '0x1234'), store.update(record, 'rejected')]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(x => x.status === 'rejected').reason.status, 409);
  assert.equal((await store.get(record.id)).status, 'authorized'); DB.db.close();
});
test('deep payment links serve the application, assets have correct types, and unknown API routes return JSON', async () => {
  const DB = database(); const env = { DB };
  const page = await worker.fetch(request('/pay/123'), env, ctx);
  assert.equal(page.status, 200); assert.match(page.headers.get('content-type'), /text\/html/);
  const html = await page.text(); assert.match(html, /GhostPay/i);
  const path = html.match(/src="([^"]+\.js)"/)[1];
  const asset = await worker.fetch(request(path), env, ctx); assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  const unknown = await worker.fetch(request('/api/missing'), env, ctx); assert.equal(unknown.status, 404); assert.ok((await unknown.json()).error);
  const configured = await worker.fetch(request('/api/deployment'), env, ctx); assert.deepEqual(await configured.json(), deployment);
  const replace = await worker.fetch(request('/api/deployment', { transactionHash: '0x1234' }), env, ctx); assert.equal(replace.status, 409);
  DB.db.close();
});
test('public API rejects cross-origin writes, bad payloads, and oversized requests', async () => {
  const DB = database(); const env = { DB };
  const cross = request('/api/requests', {}); cross.headers.set('Origin', 'https://other.example');
  assert.equal((await worker.fetch(cross, env, ctx)).status, 403);
  assert.equal((await worker.fetch(request('/api/requests', { paymentId: '0' }), env, ctx)).status, 400);
  assert.equal((await worker.fetch(request('/api/requests', { padding: 'a'.repeat(13000) }), env, ctx)).status, 413);
  DB.db.close();
});
test('signed recipient request can be read from another session; forged wallet proof is rejected', async () => {
  const DB = database(); const env = { DB }; const originalFetch = globalThis.fetch;
  const sender = privateKeyToAccount(generatePrivateKey()); const recipient = privateKeyToAccount(generatePrivateKey());
  const now = Math.floor(Date.now() / 1000);
  globalThis.fetch = async (_url, options) => {
    const respond = rpc => ({ jsonrpc: '2.0', id: rpc.id, result: rpc.method === 'eth_call'
      ? encodeFunctionResult({ abi: escrowAbi, functionName: 'getPayment', result: { sender: sender.address, token: '0x0000000000000000000000000000000000000000', amount: 1n, expiry: BigInt(now + 3600), status: 1 } })
      : { number: '0x1', timestamp: '0x' + now.toString(16), hash: '0x' + '11'.repeat(32) } });
    const rpc = JSON.parse(options.body); return Response.json(Array.isArray(rpc) ? rpc.map(respond) : respond(rpc));
  };
  try {
    const input = { paymentId: '1', chainId: deployment.chainId, recipient: recipient.address, timestamp: now };
    input.signature = await recipient.signMessage({ message: requestMessage(input.chainId, deployment.address, input.paymentId, input.recipient, input.timestamp) });
    const created = await worker.fetch(request('/api/requests', input), env, ctx); assert.equal(created.status, 201); const record = await created.json();
    const read = await worker.fetch(request('/api/requests/' + record.id), { DB }, ctx); assert.equal((await read.json()).id, record.id);
    const forged = await worker.fetch(request('/api/requests', { ...input, recipient: sender.address }), env, ctx); assert.equal(forged.status, 403);
  } finally { globalThis.fetch = originalFetch; DB.db.close(); }
});
