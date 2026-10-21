import { getAddress, isAddress, type Address, type Hex } from 'viem';

export const P2P_CHAIN_ID = 11155111;
export const P2P_FEE_BPS = 50n;
export const DEMO_RATE_MICROS = 86_500_000n; // Illustrative fixture; NOT a market quote.
export const settlementTypes = { Settlement: [
  { name: 'tradeId', type: 'uint256' }, { name: 'termsHash', type: 'bytes32' },
  { name: 'evidenceCommitment', type: 'bytes32' }, { name: 'nullifier', type: 'bytes32' },
  { name: 'paidAt', type: 'uint256' }, { name: 'validUntil', type: 'uint256' },
] } as const;
export function settlementDomain(escrow: Address, chainId = P2P_CHAIN_ID) {
  if (chainId !== P2P_CHAIN_ID && chainId !== 31337) throw new Error('P2P sandbox only supports Sepolia.');
  return { name: 'GhostPay P2P Sandbox', version: '1', chainId, verifyingContract: escrow } as const;
}
export const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
export function parseP2PAmount(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,6})?$/.test(value)) throw new Error('Enter 1–1,000 tokens, with up to six decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (amount < 1_000_000n || amount > 1_000_000_000n) throw new Error('Sandbox trades are limited to 1–1,000 tokens.');
  return amount;
}
export function p2pQuote(gross: bigint, rateMicros: bigint) {
  if (gross < 1_000_000n || gross > 1_000_000_000n || rateMicros < 50_000_000n || rateMicros > 200_000_000n) throw new Error('Quote is outside the sandbox limits.');
  const fee = ceilDiv(gross * P2P_FEE_BPS, 10_000n);
  const inrPaise = ceilDiv(gross * rateMicros, 10_000_000_000n);
  return { gross, fee, net: gross - fee, inrPaise, rateMicros };
}
export function decimal(value: bigint, places = 6, trim = true) {
  const scale = 10n ** BigInt(places);
  const fraction = (value % scale).toString().padStart(places, '0');
  return `${value / scale}${places ? '.' + (trim ? fraction.replace(/0+$/, '') || '0' : fraction) : ''}`;
}
export interface P2PReference { factory: Address; creation: Hex; tradeId?: string }
export function p2pReference(params: URLSearchParams): P2PReference | null {
  const factory = params.get('sandbox'); const creation = params.get('creation'); const tradeId = params.get('trade');
  if (!factory || !isAddress(factory) || !creation || !/^0x[0-9a-f]{64}$/i.test(creation) || (tradeId !== null && (!/^[1-9]\d{0,76}$/.test(tradeId) || BigInt(tradeId) >= 2n ** 256n))) return null;
  return { factory: getAddress(factory), creation: creation as Hex, ...(tradeId ? { tradeId } : {}) };
}
export function p2pPath(ref: P2PReference) {
  return '/trade?' + new URLSearchParams({ sandbox: ref.factory, creation: ref.creation, ...(ref.tradeId ? { trade: ref.tradeId } : {}) });
}
