import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { encodeFunctionData, recoverMessageAddress, recoverTypedDataAddress } from 'viem';
import { escrowAbi } from '../../shared/abi.ts';
import { claimDomain, claimTypes, requestMessage } from '../../shared/protocol.ts';
import { answerApproval, createVault, exportVault, importVault, lockVault, setAllowedEscrow, setVaultOwner, unlockVault, vaultAccount, vaultSnapshot } from '../src/wallet/vault.ts';
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }, configurable: true });
const contract = '0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4'; const chainId = 11155111; const password = 'test-only-device-password-2026';
setAllowedEscrow(contract); after(() => lockVault());
test('self-custodial vault encrypts, confirms signing, locks, restores and isolates profiles', async t => {
  let address: `0x${string}`; let backup: string;
  await t.test('creates only a password-encrypted backup and blocks silent replacement', async () => {
    setVaultOwner('test-alice'); await assert.rejects(createVault('short'));
    address = await createVault(password); backup = exportVault();
    const stored = [...values.values()].join(''); assert.ok(!stored.includes(password)); assert.ok(!stored.includes(vaultAccount().publicKey.slice(2)));
    const json = JSON.parse(backup); assert.equal(json.version, 3); assert.ok(json.Crypto || json.crypto); assert.equal(vaultSnapshot().unlocked, true);
    await assert.rejects(createVault(password), /already/);
  });
  await t.test('does not sign until confirmed and binds identity proof to the local account', async () => {
    const message = requestMessage(chainId, contract, '1', address, Math.floor(Date.now() / 1000));
    const pending = vaultAccount().signMessage({ message }); assert.equal(vaultSnapshot().approval?.kind, 'message');
    answerApproval(true); const signature = await pending; assert.equal((await recoverMessageAddress({ message, signature })).toLowerCase(), address.toLowerCase());
    const denied = vaultAccount().signMessage({ message }); answerApproval(false); await assert.rejects(denied, /cancelled/);
  });
  await t.test('rejects arbitrary messages and other-domain payment authorizations before a prompt', async () => {
    await assert.rejects(vaultAccount().signMessage({ message: 'Sign into an unrelated website' }), /only signs/);
    await assert.rejects(vaultAccount().signTypedData({ domain: claimDomain(1, contract), types: claimTypes, primaryType: 'ClaimAuthorization', message: { paymentId: 1n, recipient: address, deadline: 9999999999n } }), /Unexpected/);
    assert.equal(vaultSnapshot().approval, undefined);
  });
  await t.test('approved structured signatures match the sender and correct escrow domain', async () => {
    const params = { domain: claimDomain(chainId, contract), types: claimTypes, primaryType: 'ClaimAuthorization' as const, message: { paymentId: 1n, recipient: address, deadline: 9999999999n } };
    const pending = vaultAccount().signTypedData(params); assert.equal(vaultSnapshot().approval?.kind, 'authorization'); answerApproval(true);
    const signature = await pending; assert.equal((await recoverTypedDataAddress({ ...params, signature })).toLowerCase(), address.toLowerCase());
  });
  await t.test('transaction signing is limited to Sepolia and the configured escrow', async () => {
    const data = encodeFunctionData({ abi: escrowAbi, functionName: 'refundPayment', args: [1n] });
    const tx = { chainId: 1, to: contract, data, gas: 100000n, nonce: 0, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, value: 0n } as const;
    await assert.rejects(vaultAccount().signTransaction(tx), /only transact/);
    const pending = vaultAccount().signTransaction({ ...tx, chainId, to: contract }); assert.equal(vaultSnapshot().approval?.kind, 'transaction'); answerApproval(false); await assert.rejects(pending, /cancelled/);
  });
  await t.test('locking blocks signing and a backup restores the same address into a separate profile', async () => {
    const previousSession = vaultAccount(); lockVault(); assert.throws(vaultAccount, /Unlock/); await assert.rejects(unlockVault('wrong-password'));
    assert.equal(await unlockVault(password), address); await assert.rejects(previousSession.signMessage({ message: requestMessage(chainId, contract, '1', address, 1) }), /session is locked/); assert.equal(vaultAccount().sign, undefined); assert.equal(vaultAccount().signAuthorization, undefined); setVaultOwner('test-bob'); assert.equal(vaultSnapshot().exists, false); assert.equal(vaultSnapshot().unlocked, false);
    assert.equal(await importVault(backup, password), address); lockVault();
    setVaultOwner('test-alice'); assert.equal(vaultSnapshot().exists, true); assert.equal(vaultSnapshot().address, address); assert.equal(vaultSnapshot().unlocked, false);
  });
  await t.test('switching profile during decryption cannot unlock or overwrite the new profile', async () => {
    const pending = unlockVault(password); setVaultOwner('test-charlie');
    await assert.rejects(pending, /profile changed/); assert.equal(vaultSnapshot().exists, false); assert.equal(vaultSnapshot().unlocked, false); assert.throws(vaultAccount, /Unlock/);
  });
});
