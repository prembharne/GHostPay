import { createPublicClient, http, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { readFile } from 'node:fs/promises';
import { SEPOLIA_RPC_URL } from '../shared/network.ts';
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || SEPOLIA_RPC_URL) });
if (await client.getChainId() !== sepolia.id) throw new Error('Wrong RPC chain: Sepolia is required.');
const block = await client.getBlock();
console.log(JSON.stringify({ network: 'Ethereum Sepolia', chainId: sepolia.id, latestBlock: String(block.number), blockTime: new Date(Number(block.timestamp) * 1000).toISOString() }, null, 2));
let deployment;
try { deployment = JSON.parse(await readFile(new URL('../deployments/sepolia.json', import.meta.url), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (!deployment) console.log('Contract is NOT deployed/configured yet. Open /setup and confirm deployment in MetaMask.');
else {
  if (deployment.chainId !== sepolia.id || deployment.address === zeroAddress) throw new Error('Invalid deployment manifest.');
  const code = await client.getBytecode({ address: deployment.address });
  if (!code || code === '0x') throw new Error('No contract exists at the saved Sepolia address.');
  console.log(`On-chain code found: https://sepolia.etherscan.io/address/${deployment.address}`);
}
