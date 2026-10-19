import { getAddress, isAddress, recoverMessageAddress, zeroAddress } from 'viem';
import { username, profileMessage } from '../shared/identity.ts';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const checkedUsername = value => { try { return username(value); } catch (error) { fail(error.message); } };
const record = row => row ? { username: row.username, wallet: getAddress(row.wallet), createdAt: row.created_at } : null;
export async function identity(request, db, input) {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET') {
    const address = path.match(/^\/api\/profiles\/address\/(0x[\da-fA-F]{40})$/);
    if (address) return record(await db.prepare('SELECT * FROM wallet_profiles WHERE wallet = ?').bind(address[1].toLowerCase()).first());
    const name = path.match(/^\/api\/profiles\/name\/([a-zA-Z0-9_]{3,24})$/);
    if (name) return record(await db.prepare('SELECT * FROM wallet_profiles WHERE username = ?').bind(checkedUsername(name[1])).first());
    const search = path.match(/^\/api\/profiles\/search\/([a-zA-Z0-9_]{2,24})$/);
    if (search) { const rows = await db.prepare("SELECT * FROM wallet_profiles WHERE username LIKE ? ESCAPE '!' ORDER BY username LIMIT 10").bind(search[1].toLowerCase().replaceAll('_', '!_') + '%').all(); return rows.results.map(record); }
    fail('Profile route not found.', 404);
  }
  if (request.method === 'POST' && path === '/api/profiles/resolve') {
    if (!Array.isArray(input.usernames) || !input.usernames.length || input.usernames.length > 100) fail('Resolve 1–100 usernames.');
    const names = [...new Set(input.usernames.map(checkedUsername))];
    const rows = await db.prepare(`SELECT * FROM wallet_profiles WHERE username IN (${names.map(() => '?').join(',')})`).bind(...names).all();
    return rows.results.map(record);
  }
  if (request.method !== 'POST' || path !== '/api/profiles') fail('Profile route not found.', 404);
  const { wallet, signature, timestamp, nonce } = input;
  if (!isAddress(wallet || '') || wallet.toLowerCase() === zeroAddress || !Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !/^0x[\da-fA-F]{130}$/.test(signature || '') || !/^[a-f0-9]{32}$/.test(nonce || '')) fail('Invalid or expired wallet proof.');
  const requested = input.username ? checkedUsername(input.username) : '';
  let signer; try { signer = await recoverMessageAddress({ message: profileMessage(wallet, requested, timestamp, nonce), signature }); } catch { fail('Invalid signature.', 403); }
  if (signer.toLowerCase() !== wallet.toLowerCase()) fail('Sign using the wallet you are registering.', 403);
  const existing = await db.prepare('SELECT * FROM wallet_profiles WHERE wallet = ?').bind(wallet.toLowerCase()).first();
  if (existing) { if (requested && existing.username !== requested) fail('This wallet already has a permanent username.', 409); return record(existing); }
  const name = requested || `ghost_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
  try { await db.prepare('INSERT INTO wallet_profiles (wallet, username, created_at) VALUES (?, ?, ?)').bind(wallet.toLowerCase(), name, Date.now()).run(); }
  catch { const current = await db.prepare('SELECT * FROM wallet_profiles WHERE wallet = ?').bind(wallet.toLowerCase()).first(); if (current && (!requested || current.username === requested)) return record(current); fail('That username was just taken. Choose another.', 409); }
  return record(await db.prepare('SELECT * FROM wallet_profiles WHERE wallet = ?').bind(wallet.toLowerCase()).first());
}
