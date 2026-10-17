import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPublicClient, http, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { createApp } from './app.js';
import { DeploymentRegistry } from './deployment.js';
import { SEPOLIA_RPC_URL } from '../../shared/network.js';
const root = resolve(process.cwd(), '..');
try { process.loadEnvFile(resolve(root, '.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const artifact = JSON.parse(await readFile(resolve(root, 'contracts/artifacts/contracts/GhostPayEscrow.sol/GhostPayEscrow.json'), 'utf8')) as { bytecode: Hex };
const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || SEPOLIA_RPC_URL, { timeout: 20000 }) });
if (await client.getChainId() !== sepolia.id) throw new Error('RPC must be Ethereum Sepolia (11155111).');
const registry = new DeploymentRegistry(client, artifact.bytecode, resolve(root, 'deployments/sepolia.json'));
await registry.load();
const port = Number(process.env.PORT || 3001);
createApp(client, registry.current, process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173', { registry, bytecode: artifact.bytecode }).listen(port, '127.0.0.1', () => console.log(`GhostPay Sepolia relay: http://127.0.0.1:${port} · ${registry.current.configured ? registry.current.address : 'Wallet deployment required at /setup'}`));
