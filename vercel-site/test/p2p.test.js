import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/p2p-quote.js';
function response(){return {headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('P2P quote endpoint rejects writes and never caches responses',async()=>{const res=response();await handler({method:'POST'},res);assert.equal(res.statusCode,405);assert.equal(res.headers.Allow,'GET');assert.equal(res.headers['Cache-Control'],'no-store');});
test('P2P quote endpoint reports missing setup without inventing a live rate',async()=>{const names=['P2P_ORACLE_RPC_URL','P2P_INR_USD_FEED','P2P_USDC_USD_FEED'];const old=names.map(k=>process.env[k]);try{for(const name of names)delete process.env[name];const res=response();await handler({method:'GET'},res);assert.equal(res.statusCode,503);assert.equal(res.body.configured,false);assert.equal(res.body.rateMicros,undefined);assert.equal(res.headers['Cache-Control'],'no-store');}finally{names.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]);}});
