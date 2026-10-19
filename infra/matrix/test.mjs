import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {checkServer,serverOrigin} from './check.mjs';
const generator=fileURLToPath(new URL('./configure.mjs',import.meta.url));
async function fixture(run){const root=await mkdtemp(join(tmpdir(),'ghostpay-matrix-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});}}
function configure(root,args=[],env={}){const clean={...process.env};delete clean.GOOGLE_CLIENT_ID;delete clean.GOOGLE_CLIENT_SECRET;return spawnSync(process.execPath,[generator,'--output',root,...args],{encoding:'utf8',env:{...clean,...env}});}
test('generates a portable private bundle without printing secrets and refuses regeneration',()=>fixture(async root=>{
 const r=configure(root,['--server','matrix.example.com']);assert.equal(r.status,0,r.stderr);const config=await readFile(join(root,'generated/homeserver.yaml'),'utf8');const env=await readFile(join(root,'.env'),'utf8');
 assert.match(config,/enable_registration: false/);assert.match(config,/url_preview_enabled: false/);assert.match(config,/host: postgres/);assert.ok(!config.includes('oidc_providers:'));
 const password=env.match(/POSTGRES_PASSWORD=(.+)/)[1];assert.equal(password.length,72);assert.ok(!r.stdout.includes(password));assert.ok(config.includes(password));
 for(const file of ['compose.yaml','Caddyfile','check.mjs','deploy.sh','log.config'])assert.ok((await stat(join(root,file))).size>0);
 if(process.platform!=='win32')assert.equal((await stat(join(root,'.env'))).mode&0o777,0o600);
 const retry=configure(root,['--server','matrix.other.com']);assert.notEqual(retry.status,0);assert.equal(await readFile(join(root,'.env'),'utf8'),env);
}));
test('rejects malformed hostname, credential-bearing frontend origin and partial OAuth configuration',()=>fixture(async root=>{
 for(const args of [['--server','localhost'],['--server','x.example.com;whoami'],['--server','matrix.example.com','--app','https://user:password@example.com'],['--server','matrix.example.com','--app','http://example.com']])assert.notEqual(configure(root,args).status,0);
 assert.notEqual(configure(root,['--server','matrix.example.com'],{GOOGLE_CLIENT_ID:'public-client'}).status,0);
}));
test('Google configuration uses stable subject binding and never logs its secret',()=>fixture(async root=>{
 const r=configure(root,['--server','matrix.example.com'],{GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-only-secret'});assert.equal(r.status,0,r.stderr);const s=await readFile(join(root,'generated/homeserver.yaml'),'utf8');assert.match(s,/subject_claim: sub/);assert.match(s,/https:\/\/accounts.google.com/);assert.ok(!r.stdout.includes('test-only-secret'));assert.ok(!r.stderr.includes('test-only-secret'));
}));
test('public proxy exposes only Matrix APIs, blocks admin paths and keeps PostgreSQL unbound',async()=>{
 const caddy=await readFile(new URL('./Caddyfile',import.meta.url),'utf8');const compose=await readFile(new URL('./compose.yaml',import.meta.url),'utf8');assert.match(caddy,/@matrix_api path \/_matrix\/\* \/_synapse\/client\/\*/);assert.match(caddy,/respond "Not found" 404/);assert.doesNotMatch(compose,/5432:5432|8008:8008/);assert.match(compose,/condition: service_healthy/);assert.match(compose,/no-new-privileges:true/);
});
test('readiness checks validate CORS, login, discovery and blocked admin routes',async()=>{
 let cors=true;let admin=false;let origin='';const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(cors)res.setHeader('Access-Control-Allow-Origin','*');let body;
 if(req.url==='/_matrix/client/versions')body={versions:['v1.11']};else if(req.url==='/_matrix/client/v3/login')body={flows:[{type:'m.login.password'}]};else if(req.url==='/.well-known/matrix/client')body={'m.homeserver':{base_url:origin}};else if(req.url==='/.well-known/matrix/server')body={'m.server':'127.0.0.1:443'};else{res.statusCode=admin?200:404;body={};}res.end(JSON.stringify(body));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 try{assert.equal((await checkServer(origin)).ok,true);cors=false;assert.equal((await checkServer(origin)).ok,false);cors=true;admin=true;assert.equal((await checkServer(origin)).checks.find(c=>c.name.includes('Admin')).ok,false);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('readiness rejects URL credentials, public HTTP and embedded paths',()=>{for(const url of ['http://matrix.example.com','https://user:secret@example.com','https://example.com/path','https://example.com?token=secret'])assert.throws(()=>serverOrigin(url));});
