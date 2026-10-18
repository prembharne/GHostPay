import { createConnector } from 'wagmi';
import { sepolia } from 'viem/chains';
import { lockVault, registerVaultLock, vaultAccount, vaultClient, vaultSnapshot } from './vault';

export function ghostWallet() {
  return createConnector(config => ({
    id: 'ghostpay-local', name: 'GhostPay wallet', type: 'ghostpay',
    async setup() { registerVaultLock(() => config.emitter.emit('disconnect')); },
    async connect() { const address = vaultAccount().address; return { accounts: [address] as never, chainId: sepolia.id }; },
    async disconnect() { lockVault(); },
    async getAccounts() { return vaultSnapshot().unlocked ? [vaultAccount().address] : []; },
    async getChainId() { return sepolia.id; },
    async getClient() { return vaultClient(); },
    async getProvider() { return { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [vaultAccount().address];
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'wallet_switchEthereumChain') { if (Number((params?.[0] as { chainId: string })?.chainId) !== sepolia.id) throw new Error('Only Sepolia is supported.'); return null; }
      throw new Error('Use the GhostPay signing client for this operation.');
    } }; },
    async isAuthorized() { return vaultSnapshot().unlocked; },
    async switchChain({ chainId }) { if (chainId !== sepolia.id) throw new Error('Only Ethereum Sepolia is supported.'); return sepolia; },
    onAccountsChanged(accounts) { if (!accounts.length) this.onDisconnect(); else config.emitter.emit('change', { accounts: accounts as never }); },
    onChainChanged() { config.emitter.emit('change', { chainId: sepolia.id }); },
    onDisconnect() { config.emitter.emit('disconnect'); },
  }));
}
