import { createPublicClient, http, isAddress, recoverMessageAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { escrowAbi } from '../shared/abi.ts';
import { claimDomain, claimTypes, requestMessage, rejectMessage } from '../shared/protocol.ts';
import { SEPOLIA_RPC_URL } from '../shared/network.ts';
import deployment from '../deployment.json';
import assets from 'virtual:assets';
import { RequestStore } from './store.js';
import { identity } from './identity.js';

const client = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL, { timeout: 15000, retryCount: 1 }) });
const idValid = v => typeof v === 'string' && /^[1-9]\d{0,76}$/.test(v) && BigInt(v) < 2n ** 256n;
const sigValid = v => typeof v === 'string' && /^0x[\da-fA-F]+$/.test(v) && v.length % 2 === 0;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const payment = id => client.readContract({ address: deployment.address, abi: escrowAbi, functionName: 'getPayment', args: [BigInt(id)] });
async function chainTime() { const block = await client.getBlock(); const now = BigInt(Math.floor(Date.now() / 1000)); return block.timestamp > now ? block.timestamp : now; }
async function body(request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) fail('JSON content type is required.', 415);
  if (Number(request.headers.get('content-length') || 0) > 12288) fail('Request is too large.', 413);
  const reader = request.body?.getReader(); if (!reader) fail('Missing JSON body.');
  const chunks = []; let size = 0;
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 12288) { await reader.cancel(); fail('Request is too large.', 413); } chunks.push(next.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('Invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('JSON object is required.'); return data;
}
async function rateLimit(request, env, ctx) {
  const minute = Math.floor(Date.now() / 60000);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(request.headers.get('cf-connecting-ip') || 'unknown'));
  const ip = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
  for (const [scope, limit] of [['all', 600], ...(request.method === 'POST' ? [['write', 60]] : [])]) {
    const row = await env.DB.prepare('INSERT INTO rate_windows (key, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT (key) DO UPDATE SET hits = hits + 1 RETURNING hits')
      .bind(`${scope}:${minute}:${ip}`, (minute + 2) * 60000).first();
    if (row.hits > limit) fail('Too many requests. Try again in a minute.', 429);
  }
  if (Math.random() < 0.02) ctx.waitUntil(env.DB.prepare('DELETE FROM rate_windows WHERE expires_at < ?').bind(Date.now()).run());
}
export async function api(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  if (request.method === 'POST') {
    const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin) fail('Cross-origin writes are not allowed.', 403);
  }
  await rateLimit(request, env, ctx);
  if (path === '/api/profiles' || path.startsWith('/api/profiles/')) return json(await identity(request, env.DB, request.method === 'POST' ? await body(request) : undefined));
  if (request.method === 'GET' && path === '/api/deployment') return json(deployment);
  if (path.startsWith('/api/deployment')) return json({ error: 'This public app already has a verified Sepolia deployment. Changing it is disabled.' }, 409);
  if (request.method === 'GET' && path === '/api/health') return json({ ok: true, ...deployment, blockNumber: String(await client.getBlockNumber()), storage: 'persistent' });
  const store = new RequestStore(env.DB, deployment);
  if (request.method === 'POST' && path === '/api/requests') {
    const { paymentId, chainId, recipient, timestamp, signature } = await body(request);
    if (!idValid(paymentId) || chainId !== deployment.chainId || !isAddress(recipient || '') || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !sigValid(signature)) fail('Invalid request, network, wallet proof, or timestamp.');
    const p = await payment(paymentId); const now = await chainTime();
    if (p.status !== 1 || p.expiry <= now) fail('Payment is not active.');
    const recovered = await recoverMessageAddress({ message: requestMessage(chainId, deployment.address, paymentId, recipient, timestamp), signature });
    if (recovered.toLowerCase() !== recipient.toLowerCase()) fail('The recipient must sign their own claim request.', 403);
    return json(await store.create(paymentId, recipient), 201);
  }
  const list = path.match(/^\/api\/requests\/payment\/([^/]+)$/);
  if (request.method === 'GET' && list) { if (!idValid(list[1])) fail('Invalid payment ID.'); return json(await store.list(list[1])); }
  const match = path.match(/^\/api\/requests\/([\da-f-]{36})(?:\/(authorize|reject))?$/i);
  if (!match) return json({ error: 'API route not found.' }, 404);
  const record = await store.get(match[1]); if (!record) fail('Request not found.', 404);
  if (request.method === 'GET' && !match[2]) return json(record);
  if (request.method !== 'POST' || !match[2]) return json({ error: 'API route not found.' }, 404);
  const input = await body(request);
  if (match[2] === 'authorize') {
    const { deadline, signature } = input;
    if (!idValid(deadline) || !sigValid(signature)) fail('Invalid authorization.');
    const p = await payment(record.paymentId); const now = await chainTime();
    if (!(record.status === 'pending' || (record.status === 'authorized' && BigInt(record.deadline || '0') < now))) fail('Request has already been handled.', 409);
    if (p.status !== 1 || p.expiry <= now || BigInt(deadline) > p.expiry || BigInt(deadline) <= now) fail('Payment or authorization has expired.');
    const valid = await client.verifyTypedData({ address: p.sender, domain: claimDomain(deployment.chainId, deployment.address), types: claimTypes, primaryType: 'ClaimAuthorization', message: { paymentId: BigInt(record.paymentId), recipient: record.recipient, deadline: BigInt(deadline) }, signature });
    if (!valid) fail('Only the on-chain sender can authorize this recipient.', 403);
    return json(await store.update(record, 'authorized', deadline, signature));
  }
  if (record.status !== 'pending') fail('Request has already been handled.', 409);
  if (!sigValid(input.signature)) fail('Missing sender signature.');
  const p = await payment(record.paymentId);
  const signer = await recoverMessageAddress({ message: rejectMessage(record.id, deployment.chainId, deployment.address), signature: input.signature });
  if (signer.toLowerCase() !== p.sender.toLowerCase()) fail('Only the sender can reject this request.', 403);
  return json(await store.update(record, 'rejected'));
}
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await api(request, env, ctx);
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
      const asset = assets[url.pathname] || (!/\.[^/]+$/.test(url.pathname) ? assets['/index.html'] : null);
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0)), {
        headers: { 'Content-Type': asset.type, 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' },
      });
    } catch (error) {
      const status = error.status || 503;
      if (status >= 500) console.error('GhostPay relay failure:', error.message);
      return json({ error: status >= 500 ? 'Sepolia relay temporarily unavailable. Please retry shortly.' : error.message.slice(0, 250) }, status);
    }
  },
};
