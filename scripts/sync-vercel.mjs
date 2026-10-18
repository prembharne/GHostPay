import { cp, lstat, readFile, realpath, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(root, 'frontend/dist');
const destination = resolve(root, 'vercel-site/public');
if (!destination.startsWith(root + sep) || destination !== resolve(root, 'vercel-site/public')) throw new Error('Unexpected deployment destination.');
await readFile(resolve(source, 'index.html'));
try { if ((await lstat(destination)).isSymbolicLink() || await realpath(destination) !== destination) throw new Error('Refusing to overwrite a redirected deployment directory.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
console.log('Synced the production frontend into the Vercel deployment directory.');
