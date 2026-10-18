// shared/market.ts
var marketAssets = {
  ETH: "ethereum",
  BNB: "binancecoin",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  CELO: "celo",
  S: "sonic-3",
  FTM: "fantom",
  ETC: "ethereum-classic",
  XDAI: "xdai"
};
function parseGecko(data, now = Date.now()) {
  if (!data || typeof data !== "object") throw new Error("Invalid market response.");
  const quotes = {};
  for (const [symbol, id] of Object.entries(marketAssets)) {
    const row = data[id];
    if (!row || typeof row.usd !== "number" || !Number.isFinite(row.usd) || row.usd <= 0 || row.usd > 1e12 || typeof row.last_updated_at !== "number") continue;
    const quotedAt = row.last_updated_at * 1e3;
    if (now - quotedAt > 18e4 || quotedAt - now > 6e4 || !Number.isSafeInteger(quotedAt)) continue;
    const usd = row.usd.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
    if (Number(usd) <= 0) continue;
    quotes[symbol] = { usd, source: "CoinGecko", quotedAt, fetchedAt: now, timestampKind: "provider" };
  }
  return { quotes, fetchedAt: now };
}
function parseCoinbase(data, now = Date.now()) {
  const input = data;
  if (input?.data?.currency !== "USD" || !input.data.rates) throw new Error("Invalid fallback market response.");
  const quotes = {};
  for (const symbol of Object.keys(marketAssets)) {
    const inverse = Number(input.data.rates[symbol]);
    const price = 1 / inverse;
    if (!Number.isFinite(price) || price <= 0 || price > 1e12) continue;
    quotes[symbol] = { usd: price.toFixed(12).replace(/0+$/, "").replace(/\.$/, ""), source: "Coinbase", quotedAt: now, fetchedAt: now, timestampKind: "retrieved" };
  }
  return { quotes, fetchedAt: now };
}
function createMarketService(fetcher = fetch, key) {
  let cached;
  let pending;
  return async function prices() {
    if (cached && Date.now() - cached.fetchedAt < 45e3) return cached;
    if (pending) return pending;
    pending = (async () => {
      let result = { quotes: {}, fetchedAt: Date.now() };
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(marketAssets).join(",")}&vs_currencies=usd&include_last_updated_at=true`;
        const response = await fetcher(url, { headers: key ? { "x-cg-demo-api-key": key } : {}, redirect: "error", signal: AbortSignal.timeout(8e3) });
        if (response.ok) result = parseGecko(await response.json());
      } catch {
      }
      if (Object.keys(result.quotes).length < Object.keys(marketAssets).length) {
        try {
          const response = await fetcher("https://api.coinbase.com/v2/exchange-rates?currency=USD", { redirect: "error", signal: AbortSignal.timeout(8e3) });
          if (response.ok) result.quotes = { ...parseCoinbase(await response.json()).quotes, ...result.quotes };
        } catch {
        }
      }
      if (!Object.keys(result.quotes).length) throw new Error("Live prices are temporarily unavailable.");
      cached = result;
      return result;
    })();
    try {
      return await pending;
    } finally {
      pending = void 0;
    }
  };
}
export {
  createMarketService,
  marketAssets,
  parseCoinbase,
  parseGecko
};
