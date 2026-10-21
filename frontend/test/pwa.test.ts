import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const origin='https://ghostpay.example';
async function worker(){
 const source=(await readFile(new URL('../pwa/sw-template.js',import.meta.url),'utf8')).replace('__BUILD_ID__','test-build').replace('__PRECACHE__',JSON.stringify(['/index.html','/offline.html','/assets/public-abc.js']));
 const stores=new Map<string,Map<string,Response>>();const events=new Map<string,Function>();const fetched:string[]=[];let offline=false;let skipped=0;let claimed=0;
 const path=(r:any)=>new URL(typeof r==='string'?r:r.url,origin).pathname;
 const fetch=async(r:any)=>{fetched.push(path(r));if(offline)throw new Error('offline');const body=path(r)==='/index.html'?'PUBLIC APP SHELL':path(r)==='/offline.html'?'RECONNECT FOR PAYMENT':'PUBLIC ASSET';const response=new Response(body,{headers:{'Content-Type':path(r).endsWith('.js')?'text/javascript':'text/html'}});Object.defineProperty(response,'type',{value:'basic'});return response;};
 const caches={keys:async()=>[...stores.keys()],delete:async(name:string)=>stores.delete(name),open:async(name:string)=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name)!;return {addAll:async(requests:any[])=>{for(const r of requests)store.set(path(r),await fetch(r));},match:async(r:any)=>store.get(path(r))?.clone(),put:async(r:any,response:Response)=>{store.set(path(r),response);},keys:async()=>[...store.keys()].map(p=>new Request(origin+p)),delete:async(r:any)=>store.delete(path(r))};}};
 class OriginRequest extends Request {constructor(url:any,init?:RequestInit){super(new URL(url,origin),init);}}
 const self={location:{origin},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skipped++;},addEventListener:(type:string,listener:Function)=>events.set(type,listener)};
 vm.runInNewContext(source,{self,caches,fetch,URL,Request:OriginRequest,Response,Set,Promise});
 async function lifecycle(type:string,data?:any){let wait:Promise<any>=Promise.resolve();events.get(type)!({data,waitUntil:(value:Promise<any>)=>{wait=value;}});await wait;}
 async function request(url:string,options:{mode?:string;method?:string;authorization?:string}={}){let result:Promise<Response>|undefined;events.get('fetch')!({request:{url:new URL(url,origin).href,method:options.method||'GET',mode:options.mode||'cors',headers:new Headers(options.authorization?{authorization:options.authorization}:{})},respondWith:(value:Promise<Response>)=>{result=value;}});return result?await result:undefined;}
 return {stores,fetched,lifecycle,request,setOffline:(value:boolean)=>{offline=value;},skipped:()=>skipped,claimed:()=>claimed};
}
test('manifest uses scoped standalone launch and valid maskable/Apple PNG icons',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));assert.equal(manifest.start_url,'/chat');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.id,'/');assert.ok(manifest.icons.some((i:any)=>i.purpose.includes('maskable')));
 for(const n of [180,192,512]){const png=await readFile(new URL(`../public/icons/ghostpay-${n}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),n);assert.equal(png.readUInt32BE(20),n);}
});
test('service worker never intercepts API, contracts, auth, signed queries, cross-origin RPC or POST',async()=>{
 const w=await worker();await w.lifecycle('install');const before=w.fetched.length;
 for(const p of ['/api/deployment','/api/prices','/api/profiles/name/alice','/contracts/community.json','/_matrix/client/v3/sync','/auth/callback','/chat?loginToken=secret','/assets/public-abc.js?token=secret','https://rpc.example/'])assert.equal(await w.request(p),undefined,p);
 assert.equal(await w.request('/api/deployment',{mode:'navigate'}),undefined);assert.equal(await w.request('/assets/public-abc.js',{method:'POST'}),undefined);assert.equal(await w.request('/assets/public-abc.js',{authorization:'Bearer secret'}),undefined);assert.equal(w.fetched.length,before);
});
test('offline chat opens only the public shell and payment routes get an explicit reconnect page',async()=>{
 const w=await worker();await w.lifecycle('install');w.setOffline(true);
 assert.equal(await (await w.request('/chat',{mode:'navigate'}))!.text(),'PUBLIC APP SHELL');
 for(const route of ['/create','/pay/1','/pay/v2/97/0xabc/1','/campaign/97/0xabc/1','/payments','/setup'])assert.equal(await (await w.request(route,{mode:'navigate'}))!.text(),'RECONNECT FOR PAYMENT',route);
 assert.equal(await (await w.request('/assets/public-abc.js'))!.text(),'PUBLIC ASSET');
});
test('online navigation remains fresh and is never added to the static cache',async()=>{
 const w=await worker();await w.lifecycle('install');await w.request('/create',{mode:'navigate'});await w.request('/chat',{mode:'navigate'});
 for(const store of w.stores.values()){assert.ok(!store.has('/create'));assert.ok(!store.has('/chat'));assert.ok(!store.has('/api/prices'));}
});
test('updates wait for explicit activation and preserve the previous app generation',async()=>{
 const w=await worker();w.stores.set('unrelated-app',new Map());w.stores.set('ghostpay-shell-ancient',new Map());w.stores.set('ghostpay-assets-ancient',new Map());w.stores.set('ghostpay-shell-previous',new Map());w.stores.set('ghostpay-assets-previous',new Map());await w.lifecycle('install');assert.equal(w.skipped(),0);await w.lifecycle('activate');assert.equal(w.claimed(),1);assert.ok(w.stores.has('unrelated-app'));assert.ok(w.stores.has('ghostpay-shell-previous'));assert.ok(!w.stores.has('ghostpay-shell-ancient'));await w.lifecycle('message',{type:'UNKNOWN'});assert.equal(w.skipped(),0);await w.lifecycle('message',{type:'ACTIVATE_UPDATE'});assert.equal(w.skipped(),1);
});
test('runtime static caching is bounded to 120 public assets',async()=>{
 const w=await worker();await w.lifecycle('install');for(let n=0;n<130;n++)await w.request(`/assets/public-${n}.js`);assert.equal(w.stores.get('ghostpay-assets-test-build')!.size,120);
});
