import test from 'node:test';
import assert from 'node:assert/strict';
import { parseP2PAmount, p2pQuote, p2pReference, p2pPath, settlementDomain } from '../../shared/p2p.ts';
import { chainlinkQuote, oracleRate, type OracleFeed } from '../../shared/p2pOracle.ts';
test('P2P quote conserves tokens and rounds fees and INR up using integers',()=>{
  for(const a of ['1','1.000001','100','999.999999','1000']){const gross=parseP2PAmount(a),q=p2pQuote(gross,86_500_000n);assert.equal(q.net+q.fee,gross);assert.ok(q.fee*10000n>=gross*50n);assert.ok(q.inrPaise*10_000_000_000n>=gross*86_500_000n);}
  assert.deepEqual(p2pQuote(100_000_000n,86_500_000n),{gross:100_000_000n,fee:500_000n,net:99_500_000n,inrPaise:865000n,rateMicros:86_500_000n});
  for(const a of ['0','-1','1e2','0x10','1,000','1.0000001','1000.000001','Infinity','01','1.'])assert.throws(()=>parseP2PAmount(a));
});
test('trade links require valid deployment provenance and never select a mainnet',()=>{
  const ref={factory:'0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4' as const,creation:('0x'+'a'.repeat(64)) as `0x${string}`,tradeId:'2'};
  assert.deepEqual(p2pReference(new URLSearchParams(p2pPath(ref).split('?')[1])),ref);
  for(const trade of ['0','-1','1e2',(2n**256n).toString()])assert.equal(p2pReference(new URLSearchParams({sandbox:ref.factory,creation:ref.creation,trade})),null);
  assert.equal(p2pReference(new URLSearchParams({sandbox:ref.factory})),null);assert.throws(()=>settlementDomain(ref.factory,8453));
});
const now=2000000n;
const feed=(description:string,answer:bigint):OracleFeed=>({description,answer,decimals:8,updatedAt:now-20n,roundId:4n,answeredInRound:4n});
test('oracle adapter derives INR per USDC from independently validated rounds',()=>{
  const inr=feed('INR / USD',1_156_069n),usdc=feed('USDC / USD',100_000_000n);
  const rate=oracleRate(inr,usdc,now,100n,100n);assert.ok(rate>86_000_000n&&rate<87_000_000n);
  for(const bad of [{answer:0n},{answer:-1n},{updatedAt:now+1n},{updatedAt:now-101n},{answeredInRound:3n},{description:'USD / INR'},{decimals:19},{roundId:0n}])assert.throws(()=>oracleRate({...inr,...bad},usdc,now,100n,100n));
  assert.throws(()=>oracleRate(inr,{...usdc,answer:90_000_000n},now,100n,100n));
});
test('unconfigured and wrong-chain oracle setup fail closed without inventing a live rate',async()=>{
  assert.equal((await chainlinkQuote({})).configured,false);
  await assert.rejects(chainlinkQuote({P2P_ORACLE_RPC_URL:'https://example.test',P2P_ORACLE_CHAIN_ID:'1',P2P_INR_USD_FEED:'0x123',P2P_USDC_USD_FEED:'0x123',P2P_INR_MAX_AGE:'60',P2P_USDC_MAX_AGE:'60'}));
});
