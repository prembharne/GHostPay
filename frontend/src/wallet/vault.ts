import { createWalletClient, decodeFunctionData, formatEther, http, isAddress, zeroAddress, type Address, type Hex, type PrivateKeyAccount, type TypedDataDomain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { escrowAbi } from '../../../shared/abi';
import { SEPOLIA_RPC_URL } from '../../../shared/network';
import { claimTypes } from '../../../shared/protocol';

interface VaultRecord { version: 1; address: Address; keystore: string; createdAt: number }
export interface WalletApproval { title: string; description: string; rows: [string, string][]; kind: 'message' | 'authorization' | 'transaction' }
interface VaultState { owner: string; exists: boolean; address?: Address; unlocked: boolean; busy: boolean; progress: number; approval?: WalletApproval }
let walletEpoch = 0; let owner = 'guest'; let account: PrivateKeyAccount | undefined; let allowedEscrow: Address = zeroAddress;
let record: VaultRecord | undefined; let state: VaultState = { owner, exists: false, unlocked: false, busy: false, progress: 0 };
const listeners = new Set<() => void>(); let timer: ReturnType<typeof setTimeout> | undefined;
let finishApproval: ((accepted: boolean) => void) | undefined; let onLock: (() => void) | undefined;
const key = () => `ghostpay.local-wallet.v1.${encodeURIComponent(owner)}`;
function emit(patch: Partial<VaultState> = {}) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }
export const subscribeVault = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const vaultSnapshot = () => state;
export function setAllowedEscrow(address: Address) { allowedEscrow = address; }
export function setVaultOwner(next: string) {
  if (next === owner && record) return;
  if (next !== owner) lockVault(); owner = next;
  try { const value = JSON.parse(localStorage.getItem(key()) || 'null'); record = value?.version === 1 && typeof value.keystore === 'string' && /^0x[\da-fA-F]{40}$/.test(value.address || '') ? value : undefined; } catch { record = undefined; }
  emit({ owner, exists: !!record, address: record?.address, unlocked: !!account });
}
function touch() { clearTimeout(timer); timer = setTimeout(lockVault, 5 * 60000); }
export function lockVault() { ++walletEpoch; clearTimeout(timer); account = undefined; finishApproval?.(false); finishApproval = undefined; emit({ unlocked: false, approval: undefined }); onLock?.(); }
export function registerVaultLock(fn: () => void) { onLock = fn; }
export function answerApproval(accepted: boolean) { finishApproval?.(accepted); }
async function approval(request: WalletApproval) {
  if (!account) throw new Error('Unlock your GhostPay wallet first.');
  if (finishApproval) throw new Error('Another wallet confirmation is already waiting.');
  touch();
  const accepted = await new Promise<boolean>(resolve => { finishApproval = resolve; emit({ approval: request }); });
  finishApproval = undefined; emit({ approval: undefined });
  if (!accepted || !account) throw Object.assign(new Error('Request cancelled in your wallet.'), { code: 4001 });
  touch();
}
function unlockPrivateKey(privateKey: Hex, expectedAddress: Address) {
  const base = privateKeyToAccount(privateKey); if (base.address.toLowerCase() !== expectedAddress.toLowerCase()) throw new Error('The encrypted wallet address does not match.');
  const epoch = ++walletEpoch; const ensureSigner = () => { if (epoch !== walletEpoch || !account) throw new Error('This wallet session is locked. Unlock it again.'); };
  account = {
    address: base.address, publicKey: base.publicKey, source: base.source, type: base.type,
    signMessage: async params => {
      ensureSigner();
      const message = typeof params.message === 'string' ? params.message : new TextDecoder().decode(typeof params.message.raw === 'string' ? Uint8Array.from(params.message.raw.slice(2).match(/.{2}/g) || [], h => parseInt(h, 16)) : params.message.raw);
      if (!/^GhostPay (claim request|reject request)\n/.test(message) || !message.includes(`Chain: ${sepolia.id}`) || !message.includes(`Contract: ${allowedEscrow.toLowerCase()}`)) throw new Error('This wallet only signs GhostPay identity and rejection messages for the configured Sepolia escrow.');
      await approval({ kind: 'message', title: 'Confirm this wallet message.', description: 'This proves wallet control. It does not authorize an ETH transfer.', rows: [['Network', 'Ethereum Sepolia'], ['Message', message]] });
      ensureSigner(); return base.signMessage(params);
    },
    signTypedData: async params => {
      ensureSigner();
      const domain = params.domain as TypedDataDomain | undefined; const message = params.message as Record<string, unknown>;
      if (domain?.name !== 'GhostPay' || domain.version !== '1' || Number(domain.chainId) !== sepolia.id || domain.verifyingContract?.toLowerCase() !== allowedEscrow.toLowerCase() || params.primaryType !== 'ClaimAuthorization') throw new Error('Unexpected signing domain. Only configured GhostPay Sepolia approvals are supported.');
      if (JSON.stringify(params.types?.ClaimAuthorization) !== JSON.stringify(claimTypes.ClaimAuthorization) || !isAddress(String(message.recipient)) || !/^[1-9]\d{0,76}$/.test(String(message.paymentId)) || !/^\d{1,76}$/.test(String(message.deadline))) throw new Error('Unexpected authorization fields.');
      await approval({ kind: 'authorization', title: 'Approve this exact wallet?', description: 'This wallet may claim the full payment before the deadline. The approval cannot be revoked early.', rows: [['Payment', `#${String(message.paymentId)}`], ['Recipient', String(message.recipient)], ['Deadline', new Date(Number(message.deadline) * 1000).toLocaleString()], ['Network', 'Ethereum Sepolia'], ['Contract', allowedEscrow]] });
      ensureSigner(); return base.signTypedData(params);
    },
    signTransaction: async (transaction, options) => {
      ensureSigner();
      if (transaction.chainId !== sepolia.id || transaction.to?.toLowerCase() !== allowedEscrow.toLowerCase() || !transaction.data) throw new Error('This test wallet can only transact with the configured GhostPay Sepolia escrow.');
      const decoded = decodeFunctionData({ abi: escrowAbi, data: transaction.data });
      if (!['createETHPayment', 'claimPayment', 'refundPayment'].includes(decoded.functionName)) throw new Error('Unsupported escrow transaction.');
      const title = decoded.functionName === 'createETHPayment' ? 'Create this escrow deposit?' : decoded.functionName === 'claimPayment' ? 'Claim this payment?' : 'Refund your unclaimed payment?';
      const fee = (transaction.gas || 0n) * (('maxFeePerGas' in transaction ? transaction.maxFeePerGas : transaction.gasPrice) || 0n);
      await approval({ kind: 'transaction', title, description: 'This submits a real Sepolia testnet transaction. Network gas applies.', rows: [['Action', decoded.functionName === 'createETHPayment' ? 'Deposit test ETH into escrow' : `Payment #${String(decoded.args?.[0])}`], ['Value sent', `${formatEther(transaction.value || 0n)} test ETH`], ['Maximum network fee', `${formatEther(fee)} test ETH`], ['Network', 'Ethereum Sepolia'], ['Contract', allowedEscrow]] });
      ensureSigner(); return base.signTransaction(transaction, options);
    },
  } as PrivateKeyAccount;
  touch(); emit({ unlocked: true, address: base.address });
}
export async function createVault(password: string, progress?: (value: number) => void) {
  if (state.busy) throw new Error('A wallet operation is already in progress.'); const operationOwner = owner; const operationEpoch = walletEpoch;
  setVaultOwner(owner); if (record) throw new Error('This profile already has a wallet. Unlock it or import its backup.');
  if (password.length < 12) throw new Error('Choose a wallet password with at least 12 characters.');
  emit({ busy: true, progress: 0 });
  try {
    const { Wallet, encryptKeystoreJson } = await import('ethers');
    const wallet = Wallet.createRandom();
    const keystore = await encryptKeystoreJson({ address: wallet.address, privateKey: wallet.privateKey }, password, { progressCallback: value => { emit({ progress: value }); progress?.(value); } });
    if (operationOwner !== owner || operationEpoch !== walletEpoch) throw new Error('Your profile changed. Open the wallet again.');
    const next: VaultRecord = { version: 1, address: wallet.address as Address, keystore, createdAt: Date.now() };
    localStorage.setItem(key(), JSON.stringify(next)); record = next;
    unlockPrivateKey(wallet.privateKey as Hex, next.address); emit({ exists: true }); return next.address;
  } finally { emit({ busy: false, progress: 0 }); }
}
export async function unlockVault(password: string) {
  if (state.busy) throw new Error('A wallet operation is already in progress.'); const operationOwner = owner; const operationEpoch = walletEpoch;
  setVaultOwner(owner); if (!record) throw new Error('No wallet found for this profile.'); const encryptedRecord = record; emit({ busy: true, progress: 0 });
  try { const { decryptKeystoreJson } = await import('ethers'); if (operationOwner !== owner || operationEpoch !== walletEpoch) throw new Error('Your profile changed. Open the wallet again.'); const wallet = await decryptKeystoreJson(encryptedRecord.keystore, password, value => emit({ progress: value })); if (operationOwner !== owner || operationEpoch !== walletEpoch) throw new Error('Your profile changed. Open the wallet again.'); unlockPrivateKey(wallet.privateKey as Hex, encryptedRecord.address); return encryptedRecord.address; }
  finally { emit({ busy: false, progress: 0 }); }
}
export async function importVault(keystore: string, password: string) {
  if (state.busy) throw new Error('A wallet operation is already in progress.'); const operationOwner = owner; const operationEpoch = walletEpoch;
  setVaultOwner(owner); if (record) throw new Error('A wallet already exists for this profile. Import into a separate profile to avoid replacing it.');
  if (keystore.length > 100000) throw new Error('Choose an Ethereum JSON keystore smaller than 100 KB.'); emit({ busy: true, progress: 0 });
  try { const { decryptKeystoreJson } = await import('ethers'); const wallet = await decryptKeystoreJson(keystore, password, value => emit({ progress: value })); if (operationOwner !== owner || operationEpoch !== walletEpoch) throw new Error('Your profile changed. Open the wallet again.'); const next: VaultRecord = { version: 1, address: wallet.address as Address, keystore, createdAt: Date.now() }; localStorage.setItem(key(), JSON.stringify(next)); record = next; unlockPrivateKey(wallet.privateKey as Hex, next.address); emit({ exists: true }); return next.address; }
  finally { emit({ busy: false, progress: 0 }); }
}
export function exportVault() { if (!record) throw new Error('No wallet to export.'); return record.keystore; }
export function vaultAccount() { if (!account) throw new Error('Unlock your GhostPay wallet first.'); touch(); return account; }
export function vaultClient() { return createWalletClient({ account: vaultAccount(), chain: sepolia, transport: http(import.meta.env?.VITE_RPC_URL || SEPOLIA_RPC_URL) }); }
