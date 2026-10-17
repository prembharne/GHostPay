import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const children = [];
await mkdir(resolve(root, 'logs'), { recursive: true });
function launch(name, cli, args, cwd) {
  const child = spawn(process.execPath, [resolve(root, cli), ...args], { cwd: resolve(root, cwd), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child); const log = createWriteStream(resolve(root, `logs/${name}.log`), { flags: 'a' });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { log.write(chunk); process.stdout.write(`[${name}] ${chunk}`); });
  child.on('error', error => console.error(name, error.message)); return child;
}
async function waitFor(url) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Service did not start: ${url}. Check logs/ and the Sepolia RPC connection.`);
}
function shutdown() { children.forEach(child => child.kill()); }
process.once('SIGINT', () => { shutdown(); process.exit(0); });
process.once('SIGTERM', () => { shutdown(); process.exit(0); });
try {
  const compile = launch('compile', 'node_modules/hardhat/dist/src/cli.js', ['compile'], 'contracts');
  await new Promise((resolve, reject) => compile.once('exit', code => code === 0 ? resolve() : reject(new Error('Contract compilation failed.'))));
  let existing;
  let occupiedByOldRelay = false;
  try { const response = await fetch('http://127.0.0.1:3001/api/deployment', { signal: AbortSignal.timeout(1500) }); if (response.ok) existing = await response.json(); else occupiedByOldRelay = true; }
  catch {}
  if (occupiedByOldRelay) throw new Error('An old relay is using port 3001. Stop the old GhostPay process and restart.');
  if (existing && existing.chainId !== 11155111) throw new Error('An old relay is using port 3001. Stop the old GhostPay process and restart.');
  if (!existing) launch('relay', 'node_modules/tsx/dist/cli.mjs', ['src/index.ts'], 'server');
  await waitFor('http://127.0.0.1:3001/api/health');
  let webRunning = false;
  try { const response = await fetch('http://127.0.0.1:5173/@vite/client', { signal: AbortSignal.timeout(1500) }); webRunning = response.ok; } catch {}
  if (!webRunning) launch('web', 'node_modules/vite/bin/vite.js', ['--host', '127.0.0.1'], 'frontend');
  // Vite startup messages give the preview URL; no page-content inspection is performed here.
  console.log('\nGhostPay uses ETHEREUM SEPOLIA (11155111). No local blockchain is started.\nApp: http://localhost:5173\nWallet deployment: http://localhost:5173/setup\nConfirm deployment in MetaMask with Sepolia test ETH. No signing key is needed by the relay.\n');
} catch (error) { console.error(error.message); shutdown(); process.exit(1); }
