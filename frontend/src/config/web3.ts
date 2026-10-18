import { createConfig, http, injected } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { isAddress, zeroAddress, type Address } from 'viem';
import { SEPOLIA_RPC_URL, SEPOLIA_EXPLORER } from '../../../shared/network';
import { evmTestnets } from '../../../shared/evm-networks';
import { chainFor } from '../../../shared/nativeProtocol';
import { ghostWallet } from '../wallet/connector';
import { setAllowedEscrow } from '../wallet/vault';
export { escrowAbi } from '../../../shared/abi';
export { claimDomain, claimTypes, requestMessage, rejectMessage } from '../../../shared/protocol';
export let contractAddress: Address = zeroAddress;
export let deployed = false;
export let deploymentBlock = 0n;
export let deploymentIssue = '';
const browserRpcUrl = import.meta.env.VITE_RPC_URL || SEPOLIA_RPC_URL;
export const chain = { ...sepolia, rpcUrls: { default: { http: [browserRpcUrl] } } } as const;
export const explorer = SEPOLIA_EXPLORER;
export function configureDeployment(data: { address?: string; chainId?: number; blockNumber?: string; configured?: boolean }) {
  if (data.chainId !== chain.id) throw new Error('The relay is not configured for Ethereum Sepolia.');
  if (!data.configured) return;
  if (!isAddress(data.address || '') || data.address === zeroAddress || !/^\d+$/.test(data.blockNumber || '')) throw new Error('Invalid Sepolia deployment configuration.');
  contractAddress = data.address as Address; deploymentBlock = BigInt(data.blockNumber!); deployed = true; setAllowedEscrow(contractAddress);
}
export function setDeploymentIssue(message: string) { deploymentIssue = message; }
export const config = createConfig({ chains: [chain, ...evmTestnets.filter(network => network.id !== chain.id).map(chainFor)], connectors: [injected({ target: 'metaMask' }), ghostWallet()], transports: Object.fromEntries(evmTestnets.map(network => [network.id, http(network.id === chain.id ? browserRpcUrl : network.rpc, { timeout: 20000, retryCount: 1 })])) });
