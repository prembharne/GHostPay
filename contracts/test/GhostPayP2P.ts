import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { keccak256, stringToHex, zeroAddress, zeroHash, type Hex } from 'viem';
import { p2pQuote, settlementDomain, settlementTypes } from '../../shared/p2p.js';

const hash = (s: string) => keccak256(stringToHex(s));
describe('P2P testnet escrow and simulated payment evidence', () => {
  it('refuses deployment on simulated mainnet chain IDs without touching any public network',async()=>{
    for (const chainId of [1,8453,137]) {
      const {viem}=await network.create({network:'default',override:{chainId}});
      await assert.rejects(viem.deployContract('GhostPayP2PSandbox'),/TestnetOnly/);
      await assert.rejects(viem.deployContract('GhostPayMockUSDC'),/TestnetOnly/);
    }
  });
  async function setup() {
    const { viem, networkHelpers } = await network.connect();
    const [seller,buyer,attacker] = await viem.getWalletClients(); const client = await viem.getPublicClient();
    const factory = await viem.deployContract('GhostPayP2PSandbox');
    const token = await viem.getContractAt('GhostPayMockUSDC', await factory.read.token());
    const escrow = await viem.getContractAt('GhostPayP2PSandboxEscrow', await factory.read.escrow());
    await token.write.faucet(); await token.write.approve([escrow.address, 100_000_000n]);
    const expiry = (await client.getBlock()).timestamp + 300n;
    return { viem,networkHelpers,seller,buyer,attacker,client,factory,token,escrow,expiry };
  }
  async function offered() {
    const x = await setup(); await x.escrow.write.createOffer([x.buyer.account.address,100_000_000n,86_500_000n,x.expiry,hash('demo payee')]); return x;
  }
  async function accepted() { const x=await offered();const t=await x.escrow.read.getTrade([1n]);await x.escrow.write.accept([1n,t.termsHash],{account:x.buyer.account});return x; }
  async function reported() {const x=await accepted();await x.escrow.write.reportPayment([1n,hash('demo canonical payment')],{account:x.buyer.account});return x;}
  async function proof(x:Awaited<ReturnType<typeof setup>>,id=1n,nonce=hash('canonical reference'),override:Record<string,unknown>={}) {
    const t=await x.escrow.read.getTrade([id]);const now=(await x.client.getBlock()).timestamp;
    const message={tradeId:id,termsHash:t.termsHash,evidenceCommitment:t.evidenceCommitment,nullifier:nonce,paidAt:now,validUntil:t.payUntil+3600n,...override} as {tradeId:bigint;termsHash:Hex;evidenceCommitment:Hex;nullifier:Hex;paidAt:bigint;validUntil:bigint};
    const signature=await x.seller.signTypedData({domain:settlementDomain(x.escrow.address,31337),types:settlementTypes,primaryType:'Settlement',message});
    return {message,signature,args:[id,message.nullifier,message.paidAt,message.validUntil,signature] as const};
  }
  it('factory fixes mock token, simulated attestor and fee recipient; token has six decimals',async()=>{
    const x=await setup();assert.equal(await x.token.read.decimals(),6);assert.equal((await x.escrow.read.token()).toLowerCase(),x.token.address.toLowerCase());assert.equal((await x.escrow.read.attestor()).toLowerCase(),x.seller.account.address.toLowerCase());assert.equal((await x.escrow.read.feeRecipient()).toLowerCase(),x.seller.account.address.toLowerCase());
  });
  it('funds exact amounts and matches integer INR and fee quotes',async()=>{
    const x=await offered();const t=await x.escrow.read.getTrade([1n]);const q=p2pQuote(t.gross,t.rateMicros);assert.equal(t.inrPaise,q.inrPaise);assert.equal(t.fee,q.fee);assert.equal(t.state,1);assert.equal(await x.escrow.read.liability(),t.gross);assert.equal(await x.token.read.balanceOf([x.escrow.address]),t.gross);
  });
  it('requires the designated buyer to accept exactly the funded terms',async()=>{
    const x=await offered();const t=await x.escrow.read.getTrade([1n]);await assert.rejects(x.escrow.write.accept([1n,t.termsHash]),/WrongParty/);await assert.rejects(x.escrow.write.accept([1n,hash('different terms')],{account:x.buyer.account}),/InvalidTerms/);await x.escrow.write.accept([1n,t.termsHash],{account:x.buyer.account});await assert.rejects(x.escrow.write.accept([1n,t.termsHash],{account:x.buyer.account}),/WrongState/);
  });
  it('does not release any tokens for a typed reference or a buyer report',async()=>{
    const x=await accepted();await assert.rejects(x.escrow.write.reportPayment([1n,hash('UTR')]),/WrongParty/);await x.escrow.write.reportPayment([1n,hash('UTR')],{account:x.buyer.account});assert.equal(await x.token.read.balanceOf([x.buyer.account.address]),0n);assert.equal(await x.escrow.read.liability(),100_000_000n);await assert.rejects(x.escrow.write.settle([1n,hash('UTR'),(await x.client.getBlock()).timestamp,x.expiry,'0x1234']),/InvalidProof/);
  });
  it('settles authenticated evidence via an untrusted relayer to fixed buyer and fee destinations',async()=>{
    const x=await reported();const p=await proof(x);await x.escrow.write.settle(p.args,{account:x.attacker.account});assert.equal(await x.token.read.balanceOf([x.buyer.account.address]),99_500_000n);assert.equal(await x.token.read.balanceOf([x.seller.account.address]),500_000n);assert.equal(await x.token.read.balanceOf([x.attacker.account.address]),0n);assert.equal(await x.escrow.read.liability(),0n);assert.equal((await x.escrow.read.getTrade([1n])).state,5);assert.equal(await x.escrow.read.consumedNullifiers([p.message.nullifier]),true);
  });
  it('rejects another signer, mutated terms/evidence, different chain and different escrow domains',async()=>{
    const x=await reported();const p=await proof(x);const domain=settlementDomain(x.escrow.address,31337);
    const bad=[await x.attacker.signTypedData({domain,types:settlementTypes,primaryType:'Settlement',message:p.message})];
    for(const message of [{...p.message,termsHash:hash('tampered')},{...p.message,evidenceCommitment:hash('other payment')}])bad.push(await x.seller.signTypedData({domain,types:settlementTypes,primaryType:'Settlement',message}));
    for(const d of [{...domain,chainId:11155111},{...domain,verifyingContract:x.token.address}])bad.push(await x.seller.signTypedData({domain:d,types:settlementTypes,primaryType:'Settlement',message:p.message}));
    for(const sig of bad)await assert.rejects(x.escrow.write.settle([1n,p.message.nullifier,p.message.paidAt,p.message.validUntil,sig]),/InvalidProof/);
    assert.equal(await x.escrow.read.liability(),100_000_000n);
  });
  it('blocks repeat settlement and cross-trade reuse of a consumed payment nullifier',async()=>{
    const x=await reported();await x.token.write.faucet();await x.token.write.approve([x.escrow.address,100_000_000n]);const now=(await x.client.getBlock()).timestamp;await x.escrow.write.createOffer([x.buyer.account.address,100_000_000n,86_500_000n,now+300n,hash('payee2')]);const t=await x.escrow.read.getTrade([2n]);await x.escrow.write.accept([2n,t.termsHash],{account:x.buyer.account});await x.escrow.write.reportPayment([2n,hash('evidence2')],{account:x.buyer.account});const a=await proof(x),b=await proof(x,2n,a.message.nullifier);await x.escrow.write.settle(a.args);await assert.rejects(x.escrow.write.settle(a.args),/WrongState/);await assert.rejects(x.escrow.write.settle(b.args),/ReplayedProof/);assert.equal(await x.escrow.read.liability(),100_000_000n);
  });
  it('binds proof to trade ID even when the same accounts and amounts are used',async()=>{
    const x=await reported();const p=await proof(x,1n,hash('ref'),{tradeId:2n});await assert.rejects(x.escrow.write.settle(p.args),/InvalidProof/);
  });
  it('rejects zero, pre-acceptance, future, late and overly long-lived evidence',async()=>{
    const x=await reported();const t=await x.escrow.read.getTrade([1n]);const now=(await x.client.getBlock()).timestamp;
    for(const overrides of [{nullifier:zeroHash},{paidAt:t.acceptedAt-1n},{paidAt:now+100n},{paidAt:t.payUntil+1n},{validUntil:now-1n},{validUntil:t.payUntil+2n*86400n+1n}]){const p=await proof(x,1n,hash('ref'),overrides);await assert.rejects(x.escrow.write.settle(p.args),/InvalidProof/);}
  });
  it('rejects expired acceptance and late reports at their contract boundaries',async()=>{
    const x=await offered();const t=await x.escrow.read.getTrade([1n]);await x.networkHelpers.time.increaseTo(t.acceptUntil);await assert.rejects(x.escrow.write.accept([1n,t.termsHash],{account:x.buyer.account}),/Expired/);
    const y=await accepted();const a=await y.escrow.read.getTrade([1n]);await y.networkHelpers.time.increaseTo(a.payUntil+1n);await assert.rejects(y.escrow.write.reportPayment([1n,hash('late')],{account:y.buyer.account}),/Expired/);
  });
  it('lets a seller cancel only before acceptance; no unilateral timeout refund after buyer accepts',async()=>{
    const x=await offered();await assert.rejects(x.escrow.write.refund([1n],{account:x.attacker.account}),/WrongParty/);await x.escrow.write.refund([1n]);assert.equal(await x.token.read.balanceOf([x.seller.account.address]),100_000_000n);assert.equal(await x.escrow.read.liability(),0n);
    const y=await accepted();await y.networkHelpers.time.increase(3*86400);await assert.rejects(y.escrow.write.refund([1n]),/WrongParty/);assert.equal(await y.escrow.read.liability(),100_000_000n);
  });
  it('lets the buyer explicitly forfeit their allocation but blocks refund after completion',async()=>{
    const x=await reported();await x.escrow.write.refund([1n],{account:x.buyer.account});assert.equal((await x.escrow.read.getTrade([1n])).state,6);assert.equal(await x.token.read.balanceOf([x.seller.account.address]),100_000_000n);await assert.rejects(x.escrow.write.refund([1n],{account:x.buyer.account}),/WrongState/);
  });
  it('disputes freeze ordinary progress but valid paid evidence can still settle without admin withdrawals',async()=>{
    const x=await reported();await assert.rejects(x.escrow.write.dispute([1n],{account:x.attacker.account}),/WrongParty/);await x.escrow.write.dispute([1n]);await assert.rejects(x.escrow.write.refund([1n]),/WrongParty/);const p=await proof(x);await x.escrow.write.settle(p.args);assert.equal((await x.escrow.read.getTrade([1n])).state,5);
  });
  it('rejects malformed offers, invalid counterparty, rate, bounds and zero commitments atomically',async()=>{
    const x=await setup();const valid=[x.buyer.account.address,100_000_000n,86_500_000n,x.expiry,hash('payee')] as const;
    for(const args of [[zeroAddress,...valid.slice(1)],[x.seller.account.address,...valid.slice(1)],[x.escrow.address,...valid.slice(1)],[valid[0],0n,...valid.slice(2)],[valid[0],1_000_000_001n,...valid.slice(2)],[valid[0],valid[1],49_999_999n,valid[3],valid[4]],[...valid.slice(0,3),x.expiry+1000n,valid[4]],[...valid.slice(0,4),zeroHash]])await assert.rejects(x.escrow.write.createOffer(args as unknown as typeof valid),/InvalidTerms/);
    assert.equal(await x.escrow.read.nextTradeId(),1n);assert.equal(await x.escrow.read.liability(),0n);
  });
  it('rejects deflationary deposits and rolls back transfer failures and proof consumption',async()=>{
    const x=await setup();const token=await x.viem.deployContract('P2PTokenFixture');const e=await x.viem.deployContract('GhostPayP2PSandboxEscrow',[token.address,x.seller.account.address,x.seller.account.address]);await token.write.approve([e.address,100_000_000n]);await token.write.setTax([true]);const now=(await x.client.getBlock()).timestamp;await assert.rejects(e.write.createOffer([x.buyer.account.address,100_000_000n,86_500_000n,now+300n,hash('payee')]),/UnsupportedToken/);assert.equal(await e.read.liability(),0n);assert.equal(await e.read.nextTradeId(),1n);await token.write.setTax([false]);await e.write.createOffer([x.buyer.account.address,100_000_000n,86_500_000n,now+300n,hash('payee')]);const t=await e.read.getTrade([1n]);await e.write.accept([1n,t.termsHash],{account:x.buyer.account});await e.write.reportPayment([1n,hash('proof')],{account:x.buyer.account});const p=await proof({...x,escrow:e});await token.write.setReject([true]);await assert.rejects(e.write.settle(p.args),/RejectedTransfer/);assert.equal(await e.read.consumedNullifiers([p.message.nullifier]),false);assert.equal(await e.read.liability(),100_000_000n);assert.equal((await e.read.getTrade([1n])).state,3);await token.write.setReject([false]);await e.write.settle(p.args);assert.equal(await e.read.liability(),0n);
  });
  it('rejects zero evidence and nonexistent trades, and preserves funded liabilities',async()=>{
    const x=await accepted();await assert.rejects(x.escrow.write.reportPayment([1n,zeroHash],{account:x.buyer.account}),/InvalidTerms/);await assert.rejects(x.escrow.write.refund([999n]),/WrongState/);await assert.rejects(x.escrow.write.dispute([999n]),/WrongParty/);assert.equal(await x.escrow.read.liability(),100_000_000n);
  });
});
