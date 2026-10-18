import * as chains from 'viem/chains';
import { writeFile } from 'node:fs/promises';
const recommended = [11155111, 97, 80002, 43113, 84532, 421614, 11155420, 11142220, 14601];
const seen = new Set();
// Sonic replaced the old 64165 testnet; current official documentation lists 14601.
// https://docs.soniclabs.com/sonic/build-on-sonic/getting-started
const sonicTestnet = { id: 14601, name: 'Sonic Testnet', nativeCurrency: { symbol: 'S', decimals: 18 }, testnet: true, rpcUrls: { default: { http: ['https://rpc.testnet.soniclabs.com'] } }, blockExplorers: { default: { url: 'https://testnet.sonicscan.org' } } };
const list = [...Object.values(chains), sonicTestnet].filter(chain => chain && chain.testnet === true && ![1337, 31337, 64165, 57054].includes(chain.id) && Number.isSafeInteger(chain.id) && chain.id > 0 && chain.nativeCurrency && chain.nativeCurrency.decimals >= 0 && chain.nativeCurrency.decimals <= 18 && !/BTC|TRX/i.test(chain.nativeCurrency.symbol) && chain.rpcUrls?.default?.http?.some(url => /^https:\/\//.test(url) && !/[{}]/.test(url))).filter(chain => { if (seen.has(chain.id)) return false; seen.add(chain.id); return true; }).map(chain => ({
  id: chain.id, name: chain.name, symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals,
  rpc: chain.id === 11155111 ? 'https://ethereum-sepolia-rpc.publicnode.com' : chain.rpcUrls.default.http.find(url => /^https:\/\//.test(url) && !/[{}]/.test(url)),
  explorer: chain.blockExplorers?.default?.url?.replace(/\/$/, '') || '', recommended: recommended.includes(chain.id),
})).sort((a, b) => {
  const ai = recommended.indexOf(a.id), bi = recommended.indexOf(b.id);
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.name.localeCompare(b.name);
});
await writeFile(new URL('../shared/evm-networks.ts', import.meta.url), `// Generated from installed viem chain definitions. Testnet catalog, not proof of RPC availability.\nexport interface NativeNetwork { id: number; name: string; symbol: string; decimals: number; rpc: string; explorer: string; recommended: boolean }\nexport const evmTestnets: NativeNetwork[] = ${JSON.stringify(list, null, 2)};\nexport const networkById = (id: number) => evmTestnets.find(network => network.id === id);\n`);
console.log(`Prepared ${list.length} public EVM testnet definitions.`);
