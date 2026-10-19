import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyCommunity} from '../src/payments/community.ts';
const address='0x0000000000000000000000000000000000000001';const hash=`0x${'12'.repeat(32)}`;const blockHash=`0x${'34'.repeat(32)}`;
test('new funding requires reviewed code while existing legacy campaigns retain verified claim/refund access',async()=>{
 const current=JSON.parse(await readFile(new URL('../public/contracts/community.json',import.meta.url),'utf8'));const previous=JSON.parse(await readFile(new URL('../public/contracts/community-v1.json',import.meta.url),'utf8'));assert.equal(current.version,2);assert.equal(previous.version,1);assert.notEqual(current.bytecode,previous.bytecode);
 const original=globalThis.fetch;let code=current.deployedBytecode,input=current.bytecode;
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='/contracts/community.json')return Response.json(current);if(String(url)==='/contracts/community-v1.json')return Response.json(previous);
  const parsed=JSON.parse(String(options?.body));const respond=(rpc:any)=>{let result:any;
   if(rpc.method==='eth_chainId')result='0x61';else if(rpc.method==='eth_getCode')result=code;else if(rpc.method==='eth_call')result='0x'+BigInt(97).toString(16).padStart(64,'0');else if(rpc.method==='eth_blockNumber')result='0x4';else if(rpc.method==='eth_getTransactionByHash')result={hash,blockHash,blockNumber:'0x1',transactionIndex:'0x0',from:address,to:null,input,value:'0x0',nonce:'0x0',gas:'0x100000',gasPrice:'0x1',type:'0x0',v:'0x25',r:hash,s:hash};else if(rpc.method==='eth_getTransactionReceipt')result={transactionHash:hash,transactionIndex:'0x0',blockHash,blockNumber:'0x1',from:address,to:null,contractAddress:address,cumulativeGasUsed:'0x100',gasUsed:'0x100',effectiveGasPrice:'0x1',logs:[],logsBloom:`0x${'0'.repeat(512)}`,status:'0x1',type:'0x0'};else if(rpc.method==='eth_getBlockByNumber')result={hash:blockHash,number:'0x1',timestamp:'0x1',transactions:[],uncles:[],gasLimit:'0x100000',gasUsed:'0x100',size:'0x100',extraData:'0x',parentHash:blockHash};else throw new Error('Unexpected RPC '+rpc.method);return {jsonrpc:'2.0',id:rpc.id,result};};return Response.json(Array.isArray(parsed)?parsed.map(respond):respond(parsed));
 };
 try{assert.equal(await verifyCommunity(97,address,hash),address);code=previous.deployedBytecode;input=previous.bytecode;await assert.rejects(verifyCommunity(97,address,hash),/current GhostPay/);assert.equal(await verifyCommunity(97,address,hash,true),address);input='0x1234';await assert.rejects(verifyCommunity(97,address,hash,true),/trusted GhostPay deployment/);code='0x9999';await assert.rejects(verifyCommunity(97,address,hash,true),/recognized GhostPay/);}finally{globalThis.fetch=original;}
});
