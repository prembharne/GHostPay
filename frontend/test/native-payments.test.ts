import assert from 'node:assert/strict';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { amountInNative, quoteFresh } from '../../shared/amounts.ts';
import { createMarketService, parseCoinbase, parseGecko, type MarketQuote } from '../../shared/market.ts';
import { evmTestnets } from '../../shared/evm-networks.ts';
import { nativeClaimTypes, nativeDomain, nativePath, nativeReference, parseEnvelope, requireTestnet } from '../../shared/nativeProtocol.ts';
import { testnetWallet } from '../src/payments/native.ts';
const contract = '0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4';
const reference = { version: 2 as const, chainId: 97, contract, paymentId: '1' };
const quote = (now = Date.now()): MarketQuote => ({ usd: '2500', source: 'CoinGecko', quotedAt: now, fetchedAt: now, timestampKind: 'provider' });
test('USD conversion uses exact integer math, rounds down and respects native precision', () => {
  assert.equal(amountInNative('100.00', 'usd', 18, quote()).units, 40000000000000000n);
  assert.equal(amountInNative('0.01', 'usd', 18, { ...quote(), usd: '600' }).units, 16666666666666n);
  assert.equal(amountInNative('0.123456', 'native', 6).units, 123456n);
  assert.equal(amountInNative('2', 'native', 0).units, 2n);
  for (const value of ['1e3', '0x10', '-1', '0', '1,000', '0.001']) assert.throws(() => amountInNative(value, 'usd', 18, quote()));
  assert.throws(() => amountInNative('0.1234567', 'native', 6));
  assert.throws(() => amountInNative('1', 'usd', 18, { ...quote(), quotedAt: Date.now() - 180001 }));
  assert.throws(() => amountInNative('1', 'usd', 18));
  assert.throws(() => amountInNative('9'.repeat(80), 'native', 18));
});
test('price parsing rejects stale, zero and malformed data and labels fallback timestamps honestly', () => {
  const now = 2000000000000;
  const market = parseGecko({ ethereum: { usd: 2500, last_updated_at: now / 1000 }, binancecoin: { usd: 0, last_updated_at: now / 1000 }, tron: { usd: 1, last_updated_at: now / 1000 }, bitcoin: { usd: 100000, last_updated_at: now / 1000 }, 'avalanche-2': { usd: 20, last_updated_at: now / 1000 - 181 } }, now);
  assert.equal(market.quotes.ETH?.usd, '2500'); assert.equal(market.quotes.BNB, undefined); assert.equal(market.quotes.AVAX, undefined);
  assert.equal((market.quotes as Record<string, unknown>).TRX, undefined); assert.equal((market.quotes as Record<string, unknown>).BTC, undefined);
  assert.equal(quoteFresh({ ...quote(now), quotedAt: now + 60001 }, now), false);
  const fallback = parseCoinbase({ data: { currency: 'USD', rates: { ETH: '0.0004', BNB: '0', AVAX: 'bad' } } }, now);
  assert.equal(fallback.quotes.ETH?.usd, '2500'); assert.equal(fallback.quotes.ETH?.timestampKind, 'retrieved'); assert.equal(fallback.quotes.BNB, undefined);
  assert.throws(() => parseCoinbase({ data: { currency: 'EUR', rates: {} } }, now));
});
test('price service deduplicates requests, uses fixed upstreams, caches and falls back without fake prices', async () => {
  const urls: string[] = [];
  const service = createMarketService((async (url: string) => { urls.push(url); return url.includes('coingecko') ? new Response('{}', { status: 429 }) : Response.json({ data: { currency: 'USD', rates: { ETH: '0.0004', BNB: '0.002' } } }); }) as typeof fetch);
  const [first, second] = await Promise.all([service(), service()]); assert.deepEqual(first, second); await service();
  assert.equal(urls.length, 2); assert.ok(urls[0].startsWith('https://api.coingecko.com/api/v3/simple/price?ids=')); assert.equal(urls[1], 'https://api.coinbase.com/v2/exchange-rates?currency=USD');
  assert.equal(first.quotes.ETH?.source, 'Coinbase');
  const unavailable = createMarketService((async () => new Response('{}', { status: 503 })) as typeof fetch); await assert.rejects(unavailable(), /unavailable/);
});
test('native references allow known EVM testnets and reject mainnets, other protocols and malformed proofs', () => {
  assert.ok(evmTestnets.length > 100); assert.ok(nativeReference(reference)); assert.ok(nativePath(reference).startsWith('/pay/v2/97/'));
  for (const id of [1, 56, 137, 10, 42161, 43114, 8453, 31337, 1337, 3448148188, 728126428]) { assert.equal(nativeReference({ ...reference, chainId: id }), undefined); assert.throws(() => requireTestnet(id)); }
  assert.equal(nativeReference({ ...reference, paymentId: '01' }), undefined); assert.equal(nativeReference({ ...reference, contract: '0x0000000000000000000000000000000000000000' }), undefined);
  const input = { ...reference, recipient: contract, deadline: '9999999999', signature: `0x${'1'.repeat(130)}` };
  assert.ok(parseEnvelope(JSON.stringify(input), 'authorization', reference));
  for (const patch of [{ chainId: 11155111 }, { paymentId: '2' }, { recipient: 'javascript:alert(1)' }, { signature: '0x12' }, { deadline: '-1' }]) assert.throws(() => parseEnvelope(JSON.stringify({ ...input, ...patch }), 'authorization', reference));
});
test('native approval signatures bind the exact chain, contract, payment and recipient', async () => {
  const account = privateKeyToAccount(`0x${'12'.repeat(32)}`); const domain = nativeDomain(reference);
  const params = { domain, types: nativeClaimTypes, primaryType: 'ClaimAuthorization' as const, message: { paymentId: 1n, recipient: contract, deadline: 9999999999n } };
  const signature = await account.signTypedData(params);
  assert.equal(await recoverTypedDataAddress({ ...params, signature }), account.address);
  for (const patch of [{ domain: { ...domain, chainId: 11155111 } }, { message: { ...params.message, paymentId: 2n } }]) assert.notEqual(await recoverTypedDataAddress({ ...params, ...patch, signature }), account.address);
});
test('wallet preparation never touches a provider for mainnet and rejects wrong chains/accounts before signing', async () => {
  const realFetch = globalThis.fetch; let rpcCalls = 0; let providerCalls = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { rpcCalls++; const body = JSON.parse(String(init?.body)); return Response.json({ jsonrpc: '2.0', id: body.id, result: '0x61' }); }) as typeof fetch;
  try {
    await assert.rejects(testnetWallet(1, { request: async () => { providerCalls++; throw new Error('Must not call'); } } as never, contract), /Mainnet/); assert.equal(rpcCalls, 0); assert.equal(providerCalls, 0);
    await assert.rejects(testnetWallet(97, { request: async ({ method }: { method: string }) => { providerCalls++; if (method === 'eth_chainId') return '0x38'; if (method === 'wallet_switchEthereumChain') return null; throw new Error('Unexpected signing request'); } } as never, contract), /Switch your wallet/);
    await assert.rejects(testnetWallet(97, { request: async ({ method }: { method: string }) => method === 'eth_chainId' ? '0x61' : [] } as never, contract), /wallet changed/);
  } finally { globalThis.fetch = realFetch; }
});

test('current Sonic testnet replaces obsolete mismatched chain definitions', () => {
  assert.equal(requireTestnet(14601).symbol, 'S');
  assert.throws(() => requireTestnet(64165));
  assert.throws(() => requireTestnet(57054));
});
