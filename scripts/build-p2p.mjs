import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
await build({ entryPoints: ['shared/p2pOracle.ts'], outfile: 'vercel-site/lib/p2p-oracle.js', bundle: true, platform: 'node', target: 'node24', format: 'esm' });
const destination = new URL('../frontend/public/contracts/p2p-sandbox.json', import.meta.url);
const contractNames = ['GhostPayP2PSandbox', 'GhostPayP2PSandboxEscrow', 'GhostPayMockUSDC'];
const artifacts = {};
for (const name of contractNames) {
  const artifact = JSON.parse(await readFile(new URL(`../contracts/artifacts/contracts/GhostPayP2PSandbox.sol/${name}.json`, import.meta.url), 'utf8'));
  artifacts[name] = { abi: artifact.abi, bytecode: artifact.bytecode, deployedBytecode: artifact.deployedBytecode };
}
await mkdir(new URL('../frontend/public/contracts', import.meta.url), { recursive: true });
await writeFile(destination, JSON.stringify({ version: 1, chainId: 11155111, sandboxOnly: true, ...artifacts }) + '\n');
console.log('Prepared P2P sandbox artifacts and the read-only oracle adapter.');
