import { getAddress, type Abi, type Address, type Hex } from 'viem';
import { P2P_CHAIN_ID, p2pReference, type P2PReference } from '../../../shared/p2p';
import { checkRpc, nativeClient, verifyCreation } from '../payments/native';
interface Artifact { abi: Abi; bytecode: Hex; deployedBytecode: Hex }
interface Bundle { version: number; chainId: number; sandboxOnly: boolean; GhostPayP2PSandbox: Artifact; GhostPayP2PSandboxEscrow: Artifact; GhostPayMockUSDC: Artifact }
let pending: Promise<Bundle> | undefined;
export function sandboxArtifact() {
  return pending ||= fetch('/contracts/p2p-sandbox.json', { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error('P2P sandbox contract artifact is unavailable.');
    const a = await r.json() as Bundle;
    if (a.version !== 1 || a.chainId !== P2P_CHAIN_ID || a.sandboxOnly !== true || !/^0x[\da-f]+$/i.test(a.GhostPayP2PSandbox?.bytecode)) throw new Error('Unrecognized P2P sandbox artifact.');
    return a;
  }).catch(error => { pending = undefined; throw error; });
}
export interface Sandbox { ref: P2PReference; factory: Address; token: Address; escrow: Address; attestor: Address; artifacts: Bundle }
export interface Trade { seller: Address; buyer: Address; gross: bigint; fee: bigint; inrPaise: bigint; rateMicros: bigint; acceptUntil: bigint; acceptedAt: bigint; payUntil: bigint; payeeCommitment: Hex; termsHash: Hex; evidenceCommitment: Hex; state: number }
export async function verifySandbox(ref: P2PReference): Promise<Sandbox> {
  await checkRpc(P2P_CHAIN_ID);
  const artifacts = await sandboxArtifact(); const factory = getAddress(ref.factory); const client = nativeClient(P2P_CHAIN_ID);
  if ((await client.getCode({ address: factory }))?.toLowerCase() !== artifacts.GhostPayP2PSandbox.deployedBytecode.toLowerCase()) throw new Error('This is not the exact GhostPay sandbox factory.');
  await verifyCreation(P2P_CHAIN_ID, factory, ref.creation, artifacts.GhostPayP2PSandbox.bytecode);
  const abi = artifacts.GhostPayP2PSandbox.abi;
  const [token, escrow, attestor] = await Promise.all(['token', 'escrow', 'attestor'].map(functionName => client.readContract({ address: factory, abi, functionName }) as Promise<Address>));
  // Exact no-argument creation code fixes these constructor-created children.
  return { ref, factory, token, escrow, attestor, artifacts };
}
export async function readTrade(sandbox: Sandbox, id: string) {
  return await nativeClient(P2P_CHAIN_ID).readContract({ address: sandbox.escrow, abi: sandbox.artifacts.GhostPayP2PSandboxEscrow.abi, functionName: 'getTrade', args: [BigInt(id)] }) as Trade;
}
export function savedSandbox(): P2PReference | null {
  try { const raw = JSON.parse(localStorage.getItem('ghostpay.p2p.sandbox') || 'null'); return raw && typeof raw.factory === 'string' && typeof raw.creation === 'string' ? p2pReference(new URLSearchParams({ sandbox: raw.factory, creation: raw.creation })) : null; } catch { return null; }
}
export function rememberSandbox(ref: P2PReference) {
  try { localStorage.setItem('ghostpay.p2p.sandbox', JSON.stringify({ factory: ref.factory, creation: ref.creation })); } catch { /* Keep the deployment link visible if storage is blocked. */ }
}
