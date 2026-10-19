import { defineChain, getAddress, isAddress, parseAbi, zeroAddress, type Address } from 'viem';
import { networkById, type NativeNetwork } from './evm-networks.js';
export const nativeAbi = parseAbi([
  'function createNativePayment(uint256 expiry) payable returns (uint256 paymentId)',
  'function getPayment(uint256 paymentId) view returns ((address sender,uint256 amount,uint256 expiry,uint8 status))',
  'function claimPayment(uint256 paymentId,address recipient,uint256 deadline,bytes signature)',
  'function refundPayment(uint256 paymentId)',
  'function domainChainId() view returns (uint256)',
  'function nextPaymentId() view returns (uint256)',
  'event PaymentCreated(uint256 indexed paymentId,address indexed sender,uint256 amount,uint256 expiry)',
  'event PaymentClaimed(uint256 indexed paymentId,address indexed recipient,uint256 amount)',
  'event PaymentRefunded(uint256 indexed paymentId,address indexed sender,uint256 amount)',
]);
export interface NativeReference { version: 2; chainId: number; contract: string; paymentId: string; deploymentHash?: string }
export const nativeClaimTypes = { ClaimAuthorization: [{ name: 'paymentId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' }] } as const;
export const nativeRequestTypes = { ClaimRequest: [{ name: 'paymentId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'requestedAt', type: 'uint256' }] } as const;
export const nativeDomain = (reference: NativeReference) => ({ name: 'GhostPay', version: '2', chainId: reference.chainId, verifyingContract: getAddress(reference.contract) } as const);
export function requireTestnet(id: number): NativeNetwork { const network = networkById(id); if (!network) throw new Error('Only supported EVM testnets are enabled. Mainnet payments are disabled.'); return network; }
export function chainFor(network: NativeNetwork) {
  requireTestnet(network.id);
  return defineChain({ id: network.id, name: network.name, nativeCurrency: { name: network.symbol, symbol: network.symbol, decimals: network.decimals }, rpcUrls: { default: { http: [network.rpc] } }, ...(network.explorer ? { blockExplorers: { default: { name: 'Explorer', url: network.explorer } } } : {}), testnet: true });
}
export function validId(value: unknown): value is string { return typeof value === 'string' && /^[1-9]\d{0,76}$/.test(value) && BigInt(value) < 2n ** 256n; }
export function nativeReference(value: unknown): NativeReference | undefined {
  if (!value || typeof value !== 'object') return;
  const input = value as Record<string, unknown>;
  if (input.version !== 2 || !Number.isSafeInteger(input.chainId) || !networkById(Number(input.chainId)) || typeof input.contract !== 'string' || !isAddress(input.contract) || input.contract.toLowerCase() === zeroAddress || !validId(input.paymentId)) return;
  if (input.deploymentHash !== undefined && (typeof input.deploymentHash !== 'string' || !/^0x[\da-fA-F]{64}$/.test(input.deploymentHash))) return;
  return { ...(input.deploymentHash ? { deploymentHash: input.deploymentHash as string } : {}), version: 2, chainId: Number(input.chainId), contract: getAddress(input.contract), paymentId: input.paymentId };
}
export function nativePath(ref: NativeReference) { if (!nativeReference(ref)) throw new Error('Invalid payment reference.'); return `/pay/v2/${ref.chainId}/${getAddress(ref.contract)}/${ref.paymentId}${ref.deploymentHash ? `?deployment=${ref.deploymentHash}` : ''}`; }
export interface NativeEnvelope extends NativeReference { recipient: Address; signature: `0x${string}`; deadline?: string; requestedAt?: string }
export function parseEnvelope(encoded: string, kind: 'request' | 'authorization', expected: NativeReference): NativeEnvelope {
  if (encoded.length > 3000) throw new Error('Payment proof is too large.');
  const value = JSON.parse(encoded) as NativeEnvelope; const reference = nativeReference(value);
  if (!reference || reference.chainId !== expected.chainId || reference.contract.toLowerCase() !== expected.contract.toLowerCase() || reference.paymentId !== expected.paymentId || !isAddress(value.recipient || '') || value.recipient.toLowerCase() === zeroAddress || !/^0x[\da-fA-F]{130}$/.test(value.signature || '')) throw new Error('This proof does not match the payment, network, or wallet.');
  const field = kind === 'request' ? 'requestedAt' : 'deadline';
  if (!validId(value[field])) throw new Error('Invalid proof deadline or timestamp.');
  return { ...reference, recipient: getAddress(value.recipient), signature: value.signature, [field]: value[field] };
}
