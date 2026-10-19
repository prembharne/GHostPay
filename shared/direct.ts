import { isAddress, getAddress, type Address, type Hex } from 'viem';
import { requireTestnet } from './nativeProtocol.js';
export interface DirectReference { version: 3; chainId: number; hash: Hex; from: Address; to: Address }
export function directReference(value: unknown): DirectReference | undefined {
 try { const p = value as DirectReference; if (p?.version !== 3 || !/^0x[\da-fA-F]{64}$/.test(p.hash) || !isAddress(p.from) || !isAddress(p.to) || /^0x0{40}$/i.test(p.to)) return; requireTestnet(p.chainId); return { version: 3, chainId: p.chainId, hash: p.hash, from: getAddress(p.from), to: getAddress(p.to) }; } catch { return; }
}
