import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { network } from 'hardhat';
import { zeroAddress } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
describe('Community native allocations', () => {
 async function setup() { const { viem, networkHelpers } = await network.connect(); const [organizer, alice, bob, outsider] = await viem.getWalletClients(); const client = await viem.getPublicClient(); const escrow = await viem.deployContract('GhostPayCommunity'); const expiry = (await client.getBlock()).timestamp + 3600n; return { viem, networkHelpers, organizer, alice, bob, outsider, client, escrow, expiry }; }
 async function funded() { const x = await setup(); await x.escrow.write.createCampaign(['Community contributors', [x.alice.account.address, x.bob.account.address], [10n,20n], x.expiry], { value:30n }); return x; }
 it('fully funds exactly 50 immutable allocations with one campaign deposit', async () => { const x=await setup(); const wallets=Array.from({length:50},()=>privateKeyToAccount(generatePrivateKey()).address); await x.escrow.write.createCampaign(['50 contributors',wallets,Array(50).fill(10n),x.expiry],{value:500n}); const c=await x.escrow.read.getCampaign([1n]); assert.equal(c.total,500n); assert.equal(c.remaining,500n); assert.equal((await x.escrow.read.getRecipients([1n])).length,50); for(const w of wallets) assert.equal(await x.escrow.read.allocation([1n,w]),10n); });
 it('pays each recipient their allocation and blocks double claims and outsiders',async()=>{const x=await funded(); await assert.rejects(x.escrow.write.claim([1n],{account:x.outsider.account}),/NotEligible/); await x.escrow.write.claim([1n],{account:x.alice.account}); await assert.rejects(x.escrow.write.claim([1n],{account:x.alice.account}),/AlreadyClaimed/); assert.equal((await x.escrow.read.getCampaign([1n])).remaining,20n); await x.escrow.write.claim([1n],{account:x.bob.account}); assert.equal(await x.client.getBalance({address:x.escrow.address}),0n); assert.equal((await x.escrow.read.getCampaign([1n])).claimedCount,2n);});
 it('refunds only the unclaimed remainder to the organizer after expiry',async()=>{const x=await funded();await x.escrow.write.claim([1n],{account:x.alice.account});await assert.rejects(x.escrow.write.refund([1n]),/NotExpired/);await x.networkHelpers.time.increaseTo(x.expiry);await assert.rejects(x.escrow.write.refund([1n],{account:x.outsider.account}),/NotOrganizer/);const before=await x.client.getBalance({address:x.organizer.account.address});const receipt=await x.client.waitForTransactionReceipt({hash:await x.escrow.write.refund([1n])});assert.equal(await x.client.getBalance({address:x.organizer.account.address}),before+20n-receipt.gasUsed*receipt.effectiveGasPrice);await assert.rejects(x.escrow.write.claim([1n],{account:x.bob.account}),/InvalidCampaign/);await assert.rejects(x.escrow.write.refund([1n]),/InvalidCampaign/);});
 it('blocks claims at the exact expiry and nonexistent campaigns',async()=>{const x=await funded();await assert.rejects(x.escrow.write.claim([999n],{account:x.alice.account}),/InvalidCampaign/);await x.networkHelpers.time.increaseTo(x.expiry);await assert.rejects(x.escrow.write.claim([1n],{account:x.alice.account}),/Expired/);});
 it('rejects duplicate wallets, zero allocations and zero recipients',async()=>{const x=await setup();await assert.rejects(x.escrow.write.createCampaign(['x',[x.alice.account.address,x.alice.account.address],[1n,1n],x.expiry],{value:2n}),/InvalidAllocation/);await assert.rejects(x.escrow.write.createCampaign(['x',[zeroAddress],[1n],x.expiry],{value:1n}),/InvalidAllocation/);await assert.rejects(x.escrow.write.createCampaign(['x',[x.alice.account.address],[0n],x.expiry]),/InvalidAllocation/);});
 it('rejects underfunding, overfunding and malformed campaigns',async()=>{const x=await setup();for(const value of [0n,9n,11n])await assert.rejects(x.escrow.write.createCampaign(['x',[x.alice.account.address],[10n],x.expiry],{value}),/InvalidAllocation/);await assert.rejects(x.escrow.write.createCampaign(['x',[],[],x.expiry]),/InvalidCampaign/);await assert.rejects(x.escrow.write.createCampaign(['x',[x.alice.account.address],[],x.expiry]),/InvalidCampaign/);await assert.rejects(x.escrow.write.createCampaign(['', [x.alice.account.address],[1n],x.expiry],{value:1n}),/InvalidCampaign/);});
 it('blocks reentry and rolls back rejected recipient transfers',async()=>{const x=await setup();const receiver=await x.viem.deployContract('CampaignReceiver',[x.escrow.address]);await x.escrow.write.createCampaign(['x',[receiver.address],[10n],x.expiry],{value:10n});await receiver.write.setReject([true]);await assert.rejects(receiver.write.claim([1n]),/TransferFailed/);assert.equal(await x.escrow.read.claimed([1n,receiver.address]),false);assert.equal((await x.escrow.read.getCampaign([1n])).remaining,10n);await receiver.write.setReject([false]);await receiver.write.claim([1n]);assert.equal(await receiver.read.blocked(),true);assert.equal(await x.client.getBalance({address:receiver.address}),10n);});
 it('preserves remaining funds when an organizer rejects its refund',async()=>{const x=await setup();const receiver=await x.viem.deployContract('CampaignReceiver',[x.escrow.address]);await receiver.write.fund([[x.alice.account.address],[10n],x.expiry],{value:10n});await x.networkHelpers.time.increaseTo(x.expiry);await receiver.write.setReject([true]);await assert.rejects(receiver.write.refund([1n]),/TransferFailed/);assert.equal((await x.escrow.read.getCampaign([1n])).remaining,10n);assert.equal((await x.escrow.read.getCampaign([1n])).refunded,false);await receiver.write.setReject([false]);await receiver.write.refund([1n]);assert.equal((await x.escrow.read.getCampaign([1n])).remaining,0n);});


 it('rejects unclaimable self allocations and rolls back all partial creation writes',async()=>{
  const x=await setup();await assert.rejects(x.escrow.write.createCampaign(['self',[x.escrow.address],[1n],x.expiry],{value:1n}),/InvalidAllocation/);
  await assert.rejects(x.escrow.write.createCampaign(['duplicate',[x.alice.account.address,x.bob.account.address,x.alice.account.address],[1n,2n,3n],x.expiry],{value:6n}),/InvalidAllocation/);
  assert.equal(await x.escrow.read.nextCampaignId(),1n);assert.deepEqual(await x.escrow.read.getRecipients([1n]),[]);assert.equal(await x.escrow.read.allocation([1n,x.alice.account.address]),0n);assert.equal(await x.client.getBalance({address:x.escrow.address}),0n);
 });
 it('bounds recipient count, UTF-8 title bytes, claim windows and checked arithmetic',async()=>{
  const x=await setup();const wallets=Array.from({length:101},()=>privateKeyToAccount(generatePrivateKey()).address);
  await assert.rejects(x.escrow.write.createCampaign(['too many',wallets,Array(101).fill(1n),x.expiry],{value:101n}),/InvalidCampaign/);
  await assert.rejects(x.escrow.write.createCampaign(['é'.repeat(61),[x.alice.account.address],[1n],x.expiry],{value:1n}),/InvalidCampaign/);
  const now=(await x.client.getBlock()).timestamp;
  for(const expiry of [now+30n,now+31n*86400n])await assert.rejects(x.escrow.write.createCampaign(['window',[x.alice.account.address],[1n],expiry],{value:1n}),/InvalidCampaign/);
  await assert.rejects(x.escrow.write.createCampaign(['overflow',[x.alice.account.address,x.bob.account.address],[2n**256n-1n,1n],x.expiry],{value:1n}));
  assert.equal(await x.escrow.read.nextCampaignId(),1n);
 });
 it('supports the 100-recipient bound within a 12-million gas budget',async()=>{
  const x=await setup();const wallets=Array.from({length:100},()=>privateKeyToAccount(generatePrivateKey()).address);
  const receipt=await x.client.waitForTransactionReceipt({hash:await x.escrow.write.createCampaign(['100 contributors',wallets,Array(100).fill(10n),x.expiry],{value:1000n})});
  assert.ok(receipt.gasUsed<12000000n,`gas used: ${receipt.gasUsed}`);assert.equal((await x.escrow.read.getRecipients([1n])).length,100);
 });
 it('isolates overlapping pools and blocks cross-campaign and cross-function reentry',async()=>{
  const x=await setup();const receiver=await x.viem.deployContract('CrossCampaignReceiver',[x.escrow.address]);
  for(let i=0;i<2;i++)await x.escrow.write.createCampaign(['pool',[receiver.address,x.alice.account.address],[10n,20n],x.expiry],{value:30n});
  await receiver.write.claim([1n,2n]);assert.equal(await receiver.read.claimBlocked(),true);assert.equal(await receiver.read.refundBlocked(),true);assert.equal(await receiver.read.createBlocked(),true);
  assert.equal(await x.escrow.read.claimed([2n,receiver.address]),false);assert.equal((await x.escrow.read.getCampaign([2n])).remaining,30n);assert.equal(await x.escrow.read.nextCampaignId(),3n);
  await receiver.write.claim([2n,1n]);assert.equal(await x.client.getBalance({address:receiver.address}),20n);
 });
 it('keeps forced Ether outside campaign accounting and cannot sweep another pool',async()=>{
  const x=await funded();await x.escrow.write.createCampaign(['second',[x.bob.account.address],[7n],x.expiry],{value:7n});
  await x.viem.deployContract('ForceCampaignEther',[x.escrow.address],{value:5n});
  await x.networkHelpers.time.increaseTo(x.expiry);await x.escrow.write.refund([1n]);
  assert.equal((await x.escrow.read.getCampaign([2n])).remaining,7n);assert.equal(await x.client.getBalance({address:x.escrow.address}),12n);
  await x.escrow.write.refund([2n]);assert.equal(await x.client.getBalance({address:x.escrow.address}),5n);
 });
 it('conserves aggregate liabilities through deterministic randomized multi-pool actions',async()=>{
  const x=await setup();const actors=[x.alice,x.bob,x.outsider];let seed=0x19ac2026;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const models:{id:bigint;amounts:bigint[];claimed:Set<number>;refunded:boolean}[]=[];
  for(let k=0;k<12;k++){const amounts=actors.map(()=>BigInt(random()%1000+1));const id=BigInt(k+1);await x.escrow.write.createCampaign([`Pool ${k}`,actors.map(a=>a.account.address),amounts,x.expiry],{value:amounts.reduce((a,b)=>a+b)});models.push({id,amounts,claimed:new Set(),refunded:false});}
  async function invariant(){let liability=0n;for(const m of models){const c=await x.escrow.read.getCampaign([m.id]);const total=m.amounts.reduce((a,b)=>a+b);const paid=[...m.claimed].reduce((sum,i)=>sum+m.amounts[i],0n);assert.equal(c.total,total);assert.equal(c.remaining,m.refunded?0n:total-paid);assert.equal(c.claimedCount,BigInt(m.claimed.size));assert.equal(c.refunded,m.refunded);liability+=c.remaining;}assert.equal(await x.client.getBalance({address:x.escrow.address}),liability);}
  await invariant();
  for(let k=0;k<48;k++){const m=models[random()%models.length];const a=random()%actors.length;if(m.claimed.has(a))await assert.rejects(x.escrow.write.claim([m.id],{account:actors[a].account}),/AlreadyClaimed/);else{await x.escrow.write.claim([m.id],{account:actors[a].account});m.claimed.add(a);}await invariant();}
  await x.networkHelpers.time.increaseTo(x.expiry);
  for(const m of models){if(m.claimed.size<actors.length){await x.escrow.write.refund([m.id]);m.refunded=true;}else await assert.rejects(x.escrow.write.refund([m.id]),/InvalidCampaign/);await invariant();}
 });
});
