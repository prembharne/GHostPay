import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { marketAssets, type MarketResponse, type MarketSymbol } from '../../../shared/market';
import { quoteFresh } from '../../../shared/amounts';
export function marketSymbol(symbol: string): MarketSymbol | undefined {
  const normalized = ({ tBNB: 'BNB', 'S-CELO': 'CELO', tETH: 'ETH' } as Record<string, string>)[symbol] || symbol;
  return normalized in marketAssets ? normalized as MarketSymbol : undefined;
}
export function useMarket(symbol: string) {
  const query = useQuery({ queryKey: ['native-market-prices'], queryFn: async () => {
    const response = await fetch('/api/prices', { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error('Live rates are temporarily unavailable.');
    return await response.json() as MarketResponse;
  }, staleTime: 30000, refetchInterval: 45000, retry: 1 });
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const key = marketSymbol(symbol); const candidate = key ? query.data?.quotes[key] : undefined;
  return { ...query, quote: quoteFresh(candidate, now) ? candidate : undefined, stale: !!candidate && !quoteFresh(candidate, now) };
}
