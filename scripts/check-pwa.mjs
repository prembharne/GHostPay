import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const origin = new URL(process.argv[2] || 'https://ghostpay-lac.vercel.app');
assert.equal(origin.protocol, 'https:', 'Check an HTTPS deployment.');
assert.ok(!origin.username && !origin.password && !origin.search && !origin.hash, 'Use a public origin without credentials or tokens.');
const output = new URL('../frontend/dist/', import.meta.url);
const localBuild = JSON.parse(await readFile(new URL('pwa-build.json', output), 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');
async function remote(path) {
  const response = await fetch(new URL(path, origin), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}
const deployed = await remote('/pwa-build.json');
assert.deepEqual(JSON.parse(deployed.bytes.toString()), localBuild, 'Deployment does not match this local PWA build.');
const worker = await remote('/sw.js');
assert.equal(worker.response.headers.get('service-worker-allowed'), '/');
assert.match(worker.response.headers.get('cache-control') || '', /no-store/i);
assert.match(worker.response.headers.get('content-type') || '', /javascript/i);
assert.equal(digest(worker.bytes), digest(await readFile(new URL('sw.js', output))), 'Published worker differs from the build.');
const manifest = await remote('/manifest.webmanifest');
assert.match(manifest.response.headers.get('cache-control') || '', /no-cache/i);
assert.match(manifest.response.headers.get('content-type') || '', /manifest\+json/i);
const pending = [...localBuild.files];
assert.ok(pending.length > 0 && pending.every(path => path.startsWith('/') && !path.includes('?') && !/^\/(api|contracts|auth|_matrix)(\/|$)/.test(path)), 'Precache includes a non-public path.');
let count = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let path; (path = pending.shift());) {
    const result = await remote(path);
    assert.equal(digest(result.bytes), digest(await readFile(new URL(path.slice(1), output))), `${path}: content mismatch`);
    if (!path.endsWith('.html')) assert.doesNotMatch(result.response.headers.get('content-type') || '', /text\/html/i, `${path}: HTML fallback instead of asset`);
    count++;
  }
}));
console.log(`PWA ${localBuild.version}: ${count} public precache files match the production build. Worker/manifest headers pass.`);
console.log('This verifies published assets, not physical installation, full network isolation or financial settlement.');
