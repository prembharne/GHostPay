import { it, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { recoverTypedDataAddress, type Address, type PublicClient } from 'viem';
import { createApp } from '../src/app.js';
import { claimDomain, claimTypes, requestMessage, rejectMessage } from '../../shared/protocol.js';
describe('claim relay authentication and validation',()=>{
 const sender=privateKeyToAccount(generatePrivateKey()); const recipient=privateKeyToAccount(generatePrivateKey()); const attacker=privateKeyToAccount(generatePrivateKey());
 const contract='0x1111111111111111111111111111111111111111' as Address; const now=BigInt(Math.floor(Date.now()/1000)); const expiry=now+3600n;
 let clock = now; let blockNumber = 1000000n;
 const client={getBlockNumber:async()=>blockNumber,getBlock:async()=>({timestamp:clock,number:blockNumber}),readContract:async()=>({sender:sender.address,token:'0x0000000000000000000000000000000000000000',amount:1n,expiry,status:1}),verifyTypedData:async(args:any)=>(await recoverTypedDataAddress(args)).toLowerCase()===args.address.toLowerCase()} as unknown as PublicClient;
 let server:Server;let base:string;
 before(async()=>{server=createApp(client,{address:contract,chainId:11155111}).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${(server.address() as any).port}/api`;});
 after(()=>new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve())));
 const post=async(path:string,body:unknown)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
 async function request(id='1',who=recipient){const timestamp=Number(now);const signature=await who.signMessage({message:requestMessage(11155111,contract,id,who.address,timestamp)});return post('/requests',{paymentId:id,chainId:11155111,recipient:who.address,timestamp,signature});}
 it('rejects malformed and unsigned requests',async()=>{assert.equal((await post('/requests',{paymentId:'1',recipient:recipient.address,chainId:11155111})).status,400);});
 it('rejects wrong-chain and impersonated recipient requests',async()=>{const timestamp=Number(now);const signature=await attacker.signMessage({message:requestMessage(11155111,contract,'1',recipient.address,timestamp)});assert.equal((await post('/requests',{paymentId:'1',recipient:recipient.address,chainId:11155111,timestamp,signature})).status,403);assert.equal((await post('/requests',{paymentId:'1',recipient:recipient.address,chainId:1,timestamp,signature})).status,400);});
 it('accepts signed requests and deduplicates the same recipient',async()=>{const a=await request();const b=await request();assert.equal(a.status,201);assert.equal(a.data.id,b.data.id);assert.equal(a.data.status,'pending');});
 it('rejects authorization from an attacker, then accepts the on-chain sender',async()=>{const {data:r}=await request('2');const deadline=String(expiry);const args={domain:claimDomain(11155111,contract),types:claimTypes,primaryType:'ClaimAuthorization' as const,message:{paymentId:2n,recipient:recipient.address,deadline:expiry}};const forged=await attacker.signTypedData(args);assert.equal((await post(`/requests/${r.id}/authorize`,{deadline,signature:forged})).status,403);const signature=await sender.signTypedData(args);const result=await post(`/requests/${r.id}/authorize`,{deadline,signature});assert.equal(result.status,200);assert.equal(result.data.status,'authorized');assert.equal((await post(`/requests/${r.id}/authorize`,{deadline,signature})).status,409);});
 it('rejects a deadline beyond escrow expiry',async()=>{const {data:r}=await request('3');const deadline=expiry+1n;const signature=await sender.signTypedData({domain:claimDomain(11155111,contract),types:claimTypes,primaryType:'ClaimAuthorization',message:{paymentId:3n,recipient:recipient.address,deadline}});assert.equal((await post(`/requests/${r.id}/authorize`,{deadline:String(deadline),signature})).status,400);});
 it('allows only the sender to reject requests',async()=>{const {data:r}=await request('4');const message=rejectMessage(r.id,11155111,contract);assert.equal((await post(`/requests/${r.id}/reject`,{signature:await attacker.signMessage({message})})).status,403);const result=await post(`/requests/${r.id}/reject`,{signature:await sender.signMessage({message})});assert.equal(result.status,200);assert.equal(result.data.status,'rejected');});
 it('returns 404 for unknown request IDs',async()=>{assert.equal((await fetch(base+'/requests/missing')).status,404);});
 it('restricts CORS to configured development frontend',async()=>{const res=await fetch(base+'/health',{headers:{Origin:'https://attacker.example'}});assert.equal(res.headers.get('access-control-allow-origin'),null);});
 it('renews an expired authorization without allowing an active approval to be overwritten',async()=>{
  const {data:r}=await request('5'); const sign=(deadline:bigint)=>sender.signTypedData({domain:claimDomain(11155111,contract),types:claimTypes,primaryType:'ClaimAuthorization',message:{paymentId:5n,recipient:recipient.address,deadline}});
  const firstDeadline=clock+10n; assert.equal((await post(`/requests/${r.id}/authorize`,{deadline:String(firstDeadline),signature:await sign(firstDeadline)})).status,200);
  const nextDeadline=clock+120n; const signature=await sign(nextDeadline); assert.equal((await post(`/requests/${r.id}/authorize`,{deadline:String(nextDeadline),signature})).status,409);
  clock=firstDeadline+1n; blockNumber++; const result=await post(`/requests/${r.id}/authorize`,{deadline:String(nextDeadline),signature}); assert.equal(result.status,200); assert.equal(result.data.deadline,String(nextDeadline));
 });
});
