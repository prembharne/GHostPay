import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

interface Entry { file: string; css?: string[]; imports?: string[] }
export async function buildPwa(output: string) {
  const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8')) as Record<string, Entry>;
  const paths = new Set(['/index.html', '/offline.html', '/offline-retry.js', '/manifest.webmanifest', '/icons/ghostpay-192.png', '/icons/ghostpay-512.png', '/icons/ghostpay-180.png', '/inter.woff2', '/instrument-serif-italic.woff2']);
  const visited = new Set<string>();
  function add(key: string) {
    if (visited.has(key)) return;
    visited.add(key); const entry = manifest[key];
    if (!entry) throw new Error(`Missing PWA entry: ${key}`);
    paths.add('/' + entry.file); entry.css?.forEach(path => paths.add('/' + path)); entry.imports?.forEach(add);
  }
  const messenger = Object.keys(manifest).find(key => /^assets\/Messenger-[\w-]+\.js$/.test(manifest[key].file));
  const walletHost = Object.keys(manifest).find(key => /^assets\/WalletDialog-[\w-]+\.js$/.test(manifest[key].file));
  if (!messenger || !walletHost) throw new Error('Critical application chunk missing from build manifest.');
  ['index.html', messenger, walletHost].forEach(add);
  const files = [...paths].sort();
  const hash = createHash('sha256'); let bytes = 0;
  for (const path of files) { const content = await readFile(resolve(output, path.slice(1))); hash.update(path).update(content); bytes += content.length; }
  const version = hash.digest('hex').slice(0, 16);
  const template = await readFile(new URL('./sw-template.js', import.meta.url), 'utf8');
  await writeFile(resolve(output, 'sw.js'), template.replace('__BUILD_ID__', version).replace('__PRECACHE__', JSON.stringify(files)), 'utf8');
  await writeFile(resolve(output, 'pwa-build.json'), JSON.stringify({ version, precacheBytes: bytes, files, policy: 'public application assets only; API/RPC/auth/contract data are network-only' }, null, 2) + '\n');
  console.log(`PWA: ${files.length} public shell files, ${(bytes / 1024 / 1024).toFixed(2)} MiB. Sensitive data excluded.`);
}
