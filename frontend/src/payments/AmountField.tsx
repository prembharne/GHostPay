import { ArrowDownUp, RefreshCw } from 'lucide-react';
import { amountInNative } from '../../../shared/amounts';
import { useMarket } from './useMarket';
import type { MarketQuote } from '../../../shared/market';
export function AmountField({ id, symbol, decimals = 18, value, onChange, mode, setMode, disabled = false, fixedQuote }: {
  id: string; symbol: string; decimals?: number; value: string; onChange(value: string): void;
  mode: 'usd' | 'native'; setMode(value: 'usd' | 'native'): void; disabled?: boolean; fixedQuote?: MarketQuote;
}) {
  const market = useMarket(symbol); const quote = fixedQuote || market.quote; let converted = '';
  try { if (value) { const result = amountInNative(value, mode, decimals, quote, fixedQuote?.quotedAt); converted = mode === 'usd' ? `${result.native} ${symbol}` : quote ? `$${(Number(result.native) * Number(quote.usd)).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USD reference` : ''; } } catch { /* Validation is shown when submitting. */ }
  function toggle() {
    const next = mode === 'usd' ? 'native' : 'usd';
    try { if (value) { const current = amountInNative(value, mode, decimals, market.quote); onChange(next === 'native' ? current.native : (Number(current.native) * Number(market.quote!.usd)).toFixed(2)); } } catch { onChange(''); }
    setMode(next);
  }
  return <>
    <label htmlFor={id}>Amount <span>{mode === 'usd' ? 'USD reference · testnet only' : `Test ${symbol} only`}</span></label>
    <div className="ms-amount-field gp-quoted-amount"><input id={id} aria-label={`Amount in ${mode === 'usd' ? 'USD reference' : symbol}`} value={value} onChange={e => onChange(e.target.value)} inputMode="decimal" placeholder="0.00" required disabled={disabled} autoComplete="off"/><span>{mode === 'usd' ? 'USD' : symbol}</span><button type="button" className="ms-icon" aria-label={`Enter amount in ${mode === 'usd' ? symbol : 'USD'}`} onClick={toggle} disabled={disabled || mode === 'native' && !market.quote}><ArrowDownUp size={17}/></button></div>
    <div className="gp-conversion" aria-live="polite"><strong>{converted ? `≈ ${converted}` : mode === 'usd' ? `Settles in test ${symbol}` : `Native ${symbol} amount`}</strong></div>
    <div className="gp-rate"><span className={quote ? 'gp-rate-dot' : 'gp-rate-dot unavailable'}/><span>{quote ? `1 ${symbol} ≈ $${Number(quote.usd).toLocaleString(undefined, { maximumFractionDigits: 6 })} USD · ${quote.source}` : market.isFetching ? 'Fetching a live market rate…' : market.stale ? 'Rate expired · refresh before USD conversion' : 'No live rate · native amounts are still available'}</span><button type="button" className="ms-icon" aria-label="Refresh exchange rate" onClick={() => { void market.refetch(); }} disabled={market.isFetching || disabled}><RefreshCw size={12} className={market.isFetching ? 'spin' : ''}/></button></div>
    {quote && <p className="ms-fine gp-rate-time">{fixedQuote ? 'Rate saved with this deposit' : quote.timestampKind === 'provider' ? 'Price updated' : 'Rate retrieved'} {new Date(quote.quotedAt).toLocaleTimeString()}. Estimate only; no exchange or USD guarantee.</p>}
    <p className="ms-fine gp-testnet-value">Testnet coins have no redeemable USD value. Conversion uses the corresponding mainnet coin’s market price.</p>
  </>;
}
