import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { parseEther, zeroAddress, hashTypedData } from 'viem';
import { claimDomain, claimTypes } from '../../shared/protocol.js';
import { nativeRequestTypes } from '../../shared/nativeProtocol.js';

describe('GhostPay universal native escrow security', async () => {
  async function setup() {
    const { viem, networkHelpers } = await network.connect();
    const [sender, recipient, attacker] = await viem.getWalletClients();
    const client = await viem.getPublicClient();
    const escrow = await viem.deployContract('GhostPayNativeEscrow');
    const expiry = (await client.getBlock()).timestamp + 3600n;
    const amount = parseEther('0.1');
    await escrow.write.createNativePayment([expiry], { value: amount, account: sender.account });
    const domain = { ...claimDomain(await client.getChainId(), escrow.address), version: '2' };
    const sign = (overrides: Record<string, unknown> = {}, wallet = sender, customDomain = domain) => wallet.signTypedData({
      domain: customDomain, types: claimTypes, primaryType: 'ClaimAuthorization',
      message: { paymentId: 1n, recipient: recipient.account.address, deadline: expiry, ...overrides } as any,
    });
    const claim = async (signature: `0x${string}`, id = 1n, who = recipient, deadline = expiry) => escrow.write.claimPayment([id, who.account.address, deadline, signature], { account: who.account });
    return { viem, networkHelpers, sender, recipient, attacker, client, escrow, expiry, amount, domain, sign, claim };
  }
  it('creates a payment, emits its ID, and holds the exact deposit', async () => {
    const { escrow, client, sender, amount, expiry } = await setup();
    const p = await escrow.read.getPayment([1n]);
    assert.equal(p.sender.toLowerCase(), sender.account.address.toLowerCase());
    assert.equal(p.amount, amount); assert.equal(p.expiry, expiry); assert.equal(p.status, 1);
    assert.equal(await client.getBalance({ address: escrow.address }), amount);
    assert.equal(await escrow.read.nextPaymentId(), 2n);
    const logs = await escrow.getEvents.PaymentCreated(); assert.equal(logs.length, 1); assert.equal(logs[0].args.paymentId, 1n);
  });
  it('claims with a valid EIP-712 signature and transfers funds minus gas', async () => {
    const { escrow, client, recipient, amount, claim, sign } = await setup();
    const before = await client.getBalance({ address: recipient.account.address });
    const receipt = await client.waitForTransactionReceipt({ hash: await claim(await sign()) });
    assert.equal(receipt.status, 'success');
    assert.equal(await client.getBalance({ address: recipient.account.address }), before + amount - receipt.gasUsed * receipt.effectiveGasPrice);
    assert.equal((await escrow.read.getPayment([1n])).status, 2);
    assert.equal(await client.getBalance({ address: escrow.address }), 0n);
  });
  it('rejects copied links without authorization', async () => { const x = await setup(); await assert.rejects(x.claim('0x'), /InvalidSignature/); });
  it('rejects a forged signature', async () => { const x = await setup(); await assert.rejects(x.claim(await x.sign({}, x.attacker)), /InvalidSignature/); });
  it('rejects using an approval from a different recipient wallet', async () => { const x = await setup(); await assert.rejects(x.claim(await x.sign(), 1n, x.attacker), /InvalidSignature/); });
  it('requires the transaction caller to equal the approved recipient', async () => {
    const x = await setup(); await assert.rejects(x.escrow.write.claimPayment([1n, x.recipient.account.address, x.expiry, await x.sign()], { account: x.attacker.account }), /InvalidRecipient/);
  });
  it('rejects a zero recipient', async () => { const x = await setup(); await assert.rejects(x.escrow.write.claimPayment([1n, zeroAddress, x.expiry, await x.sign()]), /InvalidRecipient/); });
  it('rejects a signature for another payment ID', async () => {
    const x = await setup(); await x.escrow.write.createNativePayment([x.expiry], { value: x.amount });
    await assert.rejects(x.claim(await x.sign(), 2n), /InvalidSignature/);
  });
  it('rejects a signature for another chain', async () => { const x = await setup(); await assert.rejects(x.claim(await x.sign({}, x.sender, { ...x.domain, chainId: 1 })), /InvalidSignature/); });
  it('rejects a signature for another contract', async () => { const x = await setup(); const other = await x.viem.deployContract('GhostPayNativeEscrow'); await assert.rejects(x.claim(await x.sign({}, x.sender, { ...x.domain, verifyingContract: other.address })), /InvalidSignature/); });
  it('rejects a repeated claim and signature replay', async () => { const x = await setup(); const sig = await x.sign(); await x.claim(sig); await assert.rejects(x.claim(sig), /PaymentNotActive/); });
  it('rejects a claim at exact payment expiration', async () => {
    const x = await setup(); const sig = await x.sign(); await x.networkHelpers.time.increaseTo(x.expiry);
    await assert.rejects(x.claim(sig), /PaymentExpired/);
  });
  it('rejects an expired authorization before payment expiry', async () => { const x = await setup(); const deadline = x.expiry - 3000n; const sig = await x.sign({ deadline }); await x.networkHelpers.time.increaseTo(deadline + 1n); await assert.rejects(x.claim(sig, 1n, x.recipient, deadline), /InvalidDeadline/); });
  it('rejects an authorization deadline beyond expiry', async () => { const x = await setup(); const deadline = x.expiry + 1n; await assert.rejects(x.claim(await x.sign({ deadline }), 1n, x.recipient, deadline), /InvalidDeadline/); });
  it('refunds the entire deposit after expiry', async () => {
    const x = await setup(); await x.networkHelpers.time.increaseTo(x.expiry);
    const before = await x.client.getBalance({ address: x.sender.account.address });
    const r = await x.client.waitForTransactionReceipt({ hash: await x.escrow.write.refundPayment([1n], { account: x.sender.account }) });
    assert.equal(await x.client.getBalance({ address: x.sender.account.address }), before + x.amount - r.gasUsed * r.effectiveGasPrice);
    assert.equal((await x.escrow.read.getPayment([1n])).status, 3);
    await assert.rejects(x.escrow.write.refundPayment([1n]), /PaymentNotActive/);
  });
  it('rejects refunds by another wallet', async () => { const x = await setup(); await x.networkHelpers.time.increaseTo(x.expiry); await assert.rejects(x.escrow.write.refundPayment([1n], { account: x.attacker.account }), /NotSender/); });
  it('rejects refunds before expiry', async () => { const x = await setup(); await assert.rejects(x.escrow.write.refundPayment([1n]), /NotExpired/); });
  it('rejects a zero-value deposit', async () => { const x = await setup(); await assert.rejects(x.escrow.write.createNativePayment([x.expiry], { value: 0n }), /ZeroAmount/); });
  it('rejects expiry outside the allowed interval', async () => { const x = await setup(); const now = (await x.client.getBlock()).timestamp; await assert.rejects(x.escrow.write.createNativePayment([now + 10n], { value: 1n }), /InvalidExpiry/); await assert.rejects(x.escrow.write.createNativePayment([now + 31n * 86400n], { value: 1n }), /InvalidExpiry/); });
  it('rejects a nonexistent payment', async () => { const x = await setup(); await assert.rejects(x.claim(await x.sign(), 999n), /PaymentNotActive/); });
  it('blocks reentrant ETH withdrawal', async () => {
    const x = await setup(); const receiver = await x.viem.deployContract('ReentrantRecipient', [x.escrow.address]);
    const signature = await x.sign({ recipient: receiver.address }); await receiver.write.claim([1n, x.expiry, signature]);
    assert.equal(await receiver.read.reentryBlocked(), true); assert.equal(await x.client.getBalance({ address: receiver.address }), x.amount);
    assert.equal((await x.escrow.read.getPayment([1n])).status, 2);
  });
  it('rolls back status and keeps funds when the recipient rejects ETH', async () => {
    const x = await setup(); const receiver = await x.viem.deployContract('ReentrantRecipient', [x.escrow.address]); await receiver.write.setReject([true]);
    await assert.rejects(receiver.write.claim([1n, x.expiry, await x.sign({ recipient: receiver.address })]), /TransferFailed/);
    assert.equal((await x.escrow.read.getPayment([1n])).status, 1); assert.equal(await x.client.getBalance({ address: x.escrow.address }), x.amount);
  });
  it('rejects version-1 approvals, invalid v and malleable high-s signatures', async () => {
    const x = await setup();
    await assert.rejects(x.claim(await x.sign({}, x.sender, { ...x.domain, version: '1' })), /InvalidSignature/);
    const sig = await x.sign();
    await assert.rejects(x.claim(`${sig.slice(0, -2)}00`), /InvalidSignature/);
    const order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
    const highS = (order - BigInt(`0x${sig.slice(66, 130)}`)).toString(16).padStart(64, '0');
    const toggledV = sig.endsWith('1b') ? '1c' : '1b';
    await assert.rejects(x.claim(`${sig.slice(0, 66)}${highS}${toggledV}`), /InvalidSignature/);
  });
  it('accepts only the ERC-1271 sender contract approved digest and signature', async () => {
    const x = await setup(); const sender = await x.viem.deployContract('NativeContractSender');
    await sender.write.fund([x.escrow.address, x.expiry], { value: 1n });
    const message = { paymentId: 2n, recipient: x.recipient.account.address, deadline: x.expiry };
    const digest = hashTypedData({ domain: x.domain, types: claimTypes, primaryType: 'ClaimAuthorization', message });
    const signature = await x.sign({ paymentId: 2n });
    await sender.write.approve([digest, signature, false]);
    await assert.rejects(x.claim(signature, 2n), /InvalidSignature/);
    await sender.write.approve([digest, signature, true]);
    await assert.rejects(x.claim(`${signature.slice(0, -2)}00`, 2n), /InvalidSignature/);
    await x.claim(signature, 2n);
    assert.equal((await x.escrow.read.getPayment([2n])).status, 2);
    assert.equal(await x.client.getBalance({ address: x.escrow.address }), x.amount);
  });
  it('completes the signed request -> sender approval -> recipient-only on-chain claim', async () => {
    const x = await setup(); const requestedAt = (await x.client.getBlock()).timestamp;
    const request = { paymentId: 1n, recipient: x.recipient.account.address, requestedAt };
    const requestSignature = await x.recipient.signTypedData({ domain: x.domain, types: nativeRequestTypes, primaryType: 'ClaimRequest', message: request });
    assert.equal(await x.client.verifyTypedData({ address: x.recipient.account.address, domain: x.domain, types: nativeRequestTypes, primaryType: 'ClaimRequest', message: request, signature: requestSignature }), true);
    await assert.rejects(x.claim(requestSignature), /InvalidSignature/);
    const deadline = requestedAt + 900n; const authorization = await x.sign({ deadline });
    await assert.rejects(x.claim(authorization, 1n, x.attacker, deadline), /InvalidSignature/);
    await x.claim(authorization, 1n, x.recipient, deadline);
    assert.equal((await x.escrow.read.getPayment([1n])).status, 2);
  });

});
