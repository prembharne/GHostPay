import { formatUnits } from 'viem';
import type { MarketQuote } from './market.js';
export function quoteFresh(quote?: MarketQuote, now = Date.now()): quote is MarketQuote {
  return !!quote && /^[0-9]+(?:\.[0-9]{1,12})?$/.test(quote.usd) && Number(quote.usd) > 0 && now - quote.quotedAt <= 180000 && quote.quotedAt - now <= 60000;
}
function rational(value: string, decimals: number) {
  if (value.length > 80 || !(decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`)).test(value)) throw new Error(`Use a positive amount with at most ${decimals} decimal places.`);
  const [whole, part = ''] = value.split('.'); return { units: BigInt(whole + part), scale: 10n ** BigInt(part.length) };
}
export function amountInNative(input: string, mode: 'usd' | 'native', decimals: number, quote?: MarketQuote, now = Date.now()) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported native precision.');
  const value = rational(input, mode === 'usd' ? 2 : decimals);
  let units: bigint;
  if (mode === 'usd') {
    if (!quoteFresh(quote, now)) throw new Error('Refresh the live rate before entering a USD reference amount.');
    const rate = rational(quote.usd, 12);
    units = value.units * rate.scale * 10n ** BigInt(decimals) / (value.scale * rate.units);
  } else units = value.units * 10n ** BigInt(decimals) / value.scale;
  if (units <= 0n || units >= 2n ** 256n) throw new Error('Amount is below one native unit or too large.');
  return { units, native: formatUnits(units, decimals) };
}
