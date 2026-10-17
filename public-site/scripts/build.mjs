import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const assets = {};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name);
    if (item.isDirectory()) await walk(path);
    else assets['/' + relative(resolve(root, 'frontend-dist'), path).replaceAll('\\', '/')] = {
      type: types[extname(path)] || 'application/octet-stream', base64: (await readFile(path)).toString('base64'),
    };
  }
}
await walk(resolve(root, 'frontend-dist'));
await mkdir(resolve(root, 'dist/server'), { recursive: true });
await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await build({ entryPoints: [resolve(root, 'worker/index.js')], outfile: resolve(root, 'dist/server/index.js'), bundle: true,
  format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  plugins: [{ name: 'embedded-assets', setup(b) { b.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'assets', namespace: 'embedded' })); b.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({ contents: 'export default ' + JSON.stringify(assets), loader: 'js' })); } }],
});
await copyFile(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
console.log(`Bundled GhostPay with ${Object.keys(assets).length} assets and the Sepolia relay.`);
