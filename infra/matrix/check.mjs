import { pathToFileURL } from 'node:url';
export function serverOrigin(value) {
 const u=new URL(value);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('Use an HTTPS server origin without credentials/path, or loopback HTTP for a local test.');return u.origin;
}
export async function checkServer(value, app='https://ghostpay-lac.vercel.app') {
 const origin=serverOrigin(value);const appOrigin=serverOrigin(app);const checks=[];
 const get=async path=>{const r=await fetch(origin+path,{headers:{Origin:appOrigin},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return {body:await r.json(),cors:r.headers.get('access-control-allow-origin')};};
 async function test(name,fn){try{checks.push({name,ok:true,detail:await fn()});}catch(e){checks.push({name,ok:false,detail:e.message});}}
 await test('Client versions and browser CORS',async()=>{const {body,cors}=await get('/_matrix/client/versions');if(!Array.isArray(body.versions)||!body.versions.length)throw new Error('No Matrix versions advertised.');if(cors!=='*'&&cors!==appOrigin)throw new Error('Browser CORS must allow the GhostPay origin.');return body.versions.join(', ');});
 await test('Password or SSO login available',async()=>{const {body}=await get('/_matrix/client/v3/login');const flows=body.flows?.filter(f=>['m.login.password','m.login.sso'].includes(f.type));if(!flows?.length)throw new Error('No supported login flow.');return flows.map(f=>f.type).join(', ');});
 await test('Client discovery points to this server',async()=>{const {body}=await get('/.well-known/matrix/client');if(body['m.homeserver']?.base_url?.replace(/\/$/,'')!==origin)throw new Error('Client discovery does not match the configured origin.');return 'Matches';});
 await test('Federation discovery uses HTTPS port',async()=>{const {body}=await get('/.well-known/matrix/server');if(body['m.server']!==new URL(origin).hostname+':443')throw new Error('Expected hostname:443 federation delegation.');return 'Port 443';});
 await test('Admin API is not publicly proxied',async()=>{const r=await fetch(origin+'/_synapse/admin/v1/server_version',{redirect:'error',signal:AbortSignal.timeout(15000)});if(r.status!==404)throw new Error(`Expected 404, got ${r.status}.`);return '404';});
 return {origin,ok:checks.every(c=>c.ok),checks,note:'Readiness only. Two-user encrypted delivery, recovery and federation need separate verification.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const result=await checkServer(process.argv[2],process.argv[3]);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}}
