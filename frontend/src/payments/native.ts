import { createPublicClient, createWalletClient, custom, getAddress, http, type Address, type EIP1193Provider, type Hex } from 'viem';
import { chainFor, nativeAbi, nativeReference, requireTestnet, type NativeReference } from '../../../shared/nativeProtocol';
export interface NativeArtifact { version: number; bytecode: Hex; deployedBytecode: Hex; abi: unknown[]; evmVersion: string; testnetOnly: boolean }
let artifactPromise: Promise<NativeArtifact> | undefined;
export function nativeArtifact() {
  return artifactPromise ||= fetch('/contracts/native-escrow.json', { cache: 'force-cache' }).then(async response => {
    if (!response.ok) throw new Error('Escrow deployment artifact is unavailable.');
    const artifact = await response.json() as NativeArtifact;
    if (artifact.version !== 2 || artifact.evmVersion !== 'paris' || artifact.testnetOnly !== true || !/^0x[\da-f]+$/i.test(artifact.bytecode) || !/^0x[\da-f]+$/i.test(artifact.deployedBytecode)) throw new Error('Invalid escrow artifact.');
    return artifact;
  }).catch(error => { artifactPromise = undefined; throw error; });
}
const makeClient = (id: number) => { const network = requireTestnet(id); return createPublicClient({ chain: chainFor(network), transport: http(network.rpc, { timeout: 18000, retryCount: 1 }) }); };
const clients = new Map<number, ReturnType<typeof makeClient>>();
export function nativeClient(id: number) {
  const network = requireTestnet(id);
  if (!clients.has(id)) clients.set(id, makeClient(id));
  return clients.get(id)!;
}
export async function checkRpc(id: number) { if (await nativeClient(id).getChainId() !== id) throw new Error('The public RPC returned a different chain. No transaction will be signed.'); }
export async function verifyNativeEscrow(id: number, address: string) {
  requireTestnet(id); const contract = getAddress(address); await checkRpc(id);
  const [artifact, code] = await Promise.all([nativeArtifact(), nativeClient(id).getCode({ address: contract })]);
  if (!code || code.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new Error('This address does not contain the exact GhostPay native escrow contract.');
  const domainId = await nativeClient(id).readContract({ address: contract, abi: nativeAbi, functionName: 'domainChainId' });
  if (domainId !== BigInt(id)) throw new Error('Escrow signing domain does not match this testnet.');
  return contract;
}
export async function testnetWallet(id: number, provider: EIP1193Provider, expectedAccount: Address) {
  const network = requireTestnet(id); await checkRpc(id); const hex = `0x${id.toString(16)}`;
  if (Number(await provider.request({ method: 'eth_chainId' })) !== id) {
    try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
    catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: network.name, nativeCurrency: { name: network.symbol, symbol: network.symbol, decimals: network.decimals }, rpcUrls: [network.rpc], ...(network.explorer ? { blockExplorerUrls: [network.explorer] } : {}) }] });
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    }
  }
  if (Number(await provider.request({ method: 'eth_chainId' })) !== id) throw new Error('Switch your wallet to the selected testnet.');
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!accounts.some(account => account.toLowerCase() === expectedAccount.toLowerCase())) throw new Error('The connected wallet changed. Reconnect before signing.');
  return createWalletClient({ account: expectedAccount, chain: chainFor(network), transport: custom(provider) });
}
const deploymentsKey = 'ghostpay.native.escrows.v2';
export function rememberedEscrow(id: number): string { try { const value = JSON.parse(localStorage.getItem(deploymentsKey) || '{}'); return typeof value[id] === 'string' ? value[id] : ''; } catch { return ''; } }
export function rememberEscrow(id: number, contract: Address) {
  let previous = {}; try { previous = JSON.parse(localStorage.getItem(deploymentsKey) || '{}'); } catch {}
  localStorage.setItem(deploymentsKey, JSON.stringify({ ...previous, [id]: contract }));
}
export interface NativeHistory extends NativeReference { hash: Hex; account: Address; createdAt: number }
export function nativeHistory(): NativeHistory[] { try { const value = JSON.parse(localStorage.getItem('ghostpay.native.payments.v2') || '[]'); return Array.isArray(value) ? value.filter(item => nativeReference(item) && typeof item.hash === 'string' && /^0x[\da-fA-F]{64}$/.test(item.hash) && typeof item.account === 'string' && /^0x[\da-fA-F]{40}$/.test(item.account) && Number.isFinite(item.createdAt)).slice(0, 200) : []; } catch { return []; } }
export function rememberNativePayment(payment: NativeHistory) {
  const entries = nativeHistory().filter(item => !(item.chainId === payment.chainId && item.contract.toLowerCase() === payment.contract.toLowerCase() && item.paymentId === payment.paymentId));
  try { localStorage.setItem('ghostpay.native.payments.v2', JSON.stringify([payment, ...entries].slice(0, 200))); } catch { /* The funded link stays visible even if storage is unavailable. */ }
}
