import { configVariable, defineConfig } from 'hardhat/config';
import { fileURLToPath } from 'node:url';
import { SEPOLIA_RPC_URL } from '../shared/network.js';
import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';
try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: { compilers: [{ version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' } }], overrides: { 'contracts/GhostPayNativeEscrow.sol': { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } } } },
  networks: {
    default: { type: 'edr-simulated', chainType: 'l1', chainId: 31337 },
    sepolia: { type: 'http', chainType: 'l1', url: process.env.SEPOLIA_RPC_URL || SEPOLIA_RPC_URL, chainId: 11155111, accounts: process.env.SEPOLIA_PRIVATE_KEY ? [configVariable('SEPOLIA_PRIVATE_KEY')] : [] },
  },
});
