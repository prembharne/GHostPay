export const marketAssets = {
  ETH: 'ethereum', BNB: 'binancecoin', POL: 'polygon-ecosystem-token', AVAX: 'avalanche-2',
  CELO: 'celo', S: 'sonic-3', FTM: 'fantom', ETC: 'ethereum-classic', XDAI: 'xdai',
} as const;
export type MarketSymbol = keyof typeof marketAssets;
export interface MarketQuote { usd: string; source: 'CoinGecko' | 'Coinbase'; quotedAt: number; fetchedAt: number; timestampKind: 'provider' | 'retrieved' }
export interface MarketResponse { quotes: Partial<Record<MarketSymbol, MarketQuote>>; fetchedAt: number }

export function parseGecko(data: unknown, now = Date.now()): MarketResponse {
  if (!data || typeof data !== 'object') throw new Error('Invalid market response.');
  const quotes: MarketResponse['quotes'] = {};
  for (const [symbol, id] of Object.entries(marketAssets)) {
    const row = (data as Record<string, { usd?: unknown; last_updated_at?: unknown }>)[id];
    if (!row || typeof row.usd !== 'number' || !Number.isFinite(row.usd) || row.usd <= 0 || row.usd > 1e12 || typeof row.last_updated_at !== 'number') continue;
    const quotedAt = row.last_updated_at * 1000;
    if (now - quotedAt > 180000 || quotedAt - now > 60000 || !Number.isSafeInteger(quotedAt)) continue;
    const usd = row.usd.toFixed(12).replace(/0+$/, '').replace(/\.$/, ''); if (Number(usd) <= 0) continue;
    quotes[symbol as MarketSymbol] = { usd, source: 'CoinGecko', quotedAt, fetchedAt: now, timestampKind: 'provider' };
  }
  return { quotes, fetchedAt: now };
}
export function parseCoinbase(data: unknown, now = Date.now()): MarketResponse {
  const input = data as { data?: { currency?: string; rates?: Record<string, string> } };
  if (input?.data?.currency !== 'USD' || !input.data.rates) throw new Error('Invalid fallback market response.');
  const quotes: MarketResponse['quotes'] = {};
  for (const symbol of Object.keys(marketAssets) as MarketSymbol[]) {
    const inverse = Number(input.data.rates[symbol]); const price = 1 / inverse;
    if (!Number.isFinite(price) || price <= 0 || price > 1e12) continue;
    quotes[symbol] = { usd: price.toFixed(12).replace(/0+$/, '').replace(/\.$/, ''), source: 'Coinbase', quotedAt: now, fetchedAt: now, timestampKind: 'retrieved' };
  }
  return { quotes, fetchedAt: now };
}
export function createMarketService(fetcher: typeof fetch = fetch, key?: string) {
  let cached: MarketResponse | undefined; let pending: Promise<MarketResponse> | undefined;
  return async function prices(): Promise<MarketResponse> {
    if (cached && Date.now() - cached.fetchedAt < 45000) return cached;
    if (pending) return pending;
    pending = (async () => {
      let result: MarketResponse = { quotes: {}, fetchedAt: Date.now() };
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(marketAssets).join(',')}&vs_currencies=usd&include_last_updated_at=true`;
        const response = await fetcher(url, { headers: key ? { 'x-cg-demo-api-key': key } : {}, redirect: 'error', signal: AbortSignal.timeout(8000) });
        if (response.ok) result = parseGecko(await response.json());
      } catch { /* Try the independently labeled fallback. */ }
      if (Object.keys(result.quotes).length < Object.keys(marketAssets).length) {
        try {
          const response = await fetcher('https://api.coinbase.com/v2/exchange-rates?currency=USD', { redirect: 'error', signal: AbortSignal.timeout(8000) });
          if (response.ok) result.quotes = { ...parseCoinbase(await response.json()).quotes, ...result.quotes };
        } catch { /* Missing assets remain unavailable, never fabricated. */ }
      }
      if (!Object.keys(result.quotes).length) throw new Error('Live prices are temporarily unavailable.');
      cached = result; return result;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}
