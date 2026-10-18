import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({ entryPoints: [fileURLToPath(new URL('../shared/market.ts', import.meta.url))], outfile: fileURLToPath(new URL('../vercel-site/lib/market.js', import.meta.url)), bundle: true, platform: 'node', format: 'esm', target: 'node24' });
console.log('Built the fixed-provider market price service.');
