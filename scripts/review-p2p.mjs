import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { keccak256 } from 'viem';
const root = fileURLToPath(new URL('..', import.meta.url));
const source = 'contracts/contracts/GhostPayP2PSandbox.sol';
const solc = process.env.SOLC_PATH || (process.platform === 'win32' ? join(process.env.LOCALAPPDATA, 'hardhat-nodejs/Cache/compilers-v3/windows-amd64/solc-windows-amd64-v0.8.28+commit.7893614a.exe') : 'solc');
const result = spawnSync('slither', [source, '--solc', solc, '--solc-remaps', '@openzeppelin/=node_modules/@openzeppelin/', '--solc-args', '--optimize --optimize-runs 200 --evm-version cancun', '--json', '-'], { cwd: root, encoding: 'utf8', maxBuffer: 8*1024*1024 });
if (result.error) throw result.error;
let report; try { report = JSON.parse(result.stdout); } catch { throw new Error('Slither failed: ' + result.stderr.slice(-1200)); }
if (!report.success) throw new Error(report.error || 'Slither compilation failed.');
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v]) => [k,normalize(v)])) : typeof value === 'string' ? value.replaceAll('\\','/').replaceAll(root.replaceAll('\\','/'),'') : value;
report = normalize(report);
const project = report.results.detectors.filter(d => d.elements.some(e => e.source_mapping?.filename_relative?.replaceAll('\\','/').startsWith('contracts/contracts/GhostPayP2PSandbox.sol')));
const dependencies = report.results.detectors.filter(d => !project.includes(d));
const count = list => list.reduce((all,d) => ({ ...all, [d.impact]: (all[d.impact] || 0)+1 }), {});
const factory = JSON.parse(await readFile(resolve(root,'contracts/artifacts/contracts/GhostPayP2PSandbox.sol/GhostPayP2PSandbox.json'),'utf8'));
report.ghostpay = { reviewType: 'Internal tool-assisted review, not an independent audit', source, sourceSha256: createHash('sha256').update(await readFile(resolve(root,source))).digest('hex'), factoryCreationKeccak256: keccak256(factory.bytecode), factoryRuntimeKeccak256: keccak256(factory.deployedBytecode), compiler: '0.8.28', optimizerRuns: 200, evmVersion: 'cancun', projectFindings: count(project), dependencyFindings: count(dependencies), dependencyReview: 'All dependency findings remain in this report. OZ 5.4 Math modular inverse uses intentional XOR and division; SignatureChecker checks the ECDSA error enum but omits auxiliary error data. See P2P-IMPLEMENTATION.md.' };
await writeFile(resolve(root,'docs/p2p-slither.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.ghostpay,null,2));
if (project.some(d => ['High','Medium'].includes(d.impact))) throw new Error('Review high/medium findings in GhostPay code.');
// Allow only the explicitly reviewed, dependency-local detector classes. A new
// dependency class at these severities fails CI rather than being hidden.
if (dependencies.some(d => ['High','Medium'].includes(d.impact) && !['incorrect-exp','divide-before-multiply','unused-return'].includes(d.check))) throw new Error('Unreviewed high/medium dependency finding.');
const notes = await readFile(resolve(root,'docs/P2P-IMPLEMENTATION.md'),'utf8');
for (const key of ['sourceSha256','factoryCreationKeccak256','factoryRuntimeKeccak256']) if (!notes.includes(report.ghostpay[key])) throw new Error('Update the P2P security review hashes before release.');
