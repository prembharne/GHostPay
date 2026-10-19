import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../contracts/artifacts/contracts/GhostPayNativeEscrow.sol/GhostPayNativeEscrow.json', import.meta.url);
const artifact = JSON.parse(await readFile(source, 'utf8'));
if (!/^0x[0-9a-f]+$/i.test(artifact.bytecode) || !/^0x[0-9a-f]+$/i.test(artifact.deployedBytecode)) throw new Error('Compile the universal escrow first.');
const destination = fileURLToPath(new URL('../frontend/public/contracts', import.meta.url));
await mkdir(destination, { recursive: true });
await writeFile(`${destination}/native-escrow.json`, JSON.stringify({ version: 2, contractName: 'GhostPayNativeEscrow', compiler: '0.8.28', evmVersion: 'paris', testnetOnly: true, bytecode: artifact.bytecode, deployedBytecode: artifact.deployedBytecode, abi: artifact.abi }) + '\n');
console.log('Prepared the single EVM native escrow artifact.');

const community = JSON.parse(await readFile(new URL('../contracts/artifacts/contracts/GhostPayCommunity.sol/GhostPayCommunity.json', import.meta.url), 'utf8'));
await writeFile(`${destination}/community.json`, JSON.stringify({ version: 1, contractName: 'GhostPayCommunity', compiler: '0.8.28', evmVersion: 'paris', testnetOnly: true, bytecode: community.bytecode, deployedBytecode: community.deployedBytecode, abi: community.abi }) + '\n');
