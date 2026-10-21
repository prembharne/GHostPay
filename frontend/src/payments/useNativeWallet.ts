import { useAccount, useConnect } from 'wagmi';
import { getAccount } from '@wagmi/core';
import type { EIP1193Provider } from 'viem';
import { testnetWallet } from './native';
import { openWalletAccount, walletConfig } from '../config/reown';
export function useNativeWallet(networkId: number) {
  const account = useAccount(); const connection = useConnect();
  async function wallet() {
    if (navigator.onLine === false) throw new Error('Reconnect before opening your wallet or approving a transaction.');
    let current = getAccount(walletConfig);
    if (!current.connector || !current.address || current.connector.id === 'ghostpay-local') { await openWalletAccount('Connect'); current = getAccount(walletConfig); }
    if (!current.connector || !current.address || current.connector.id === 'ghostpay-local') throw new Error('Connect your Google or external wallet to continue.');
    const provider = await current.connector.getProvider() as EIP1193Provider;
    if (!provider?.request) throw new Error('The connected wallet has no EVM provider.');
    return testnetWallet(networkId, provider, current.address);
  }
  return { ...account, wallet, external: !!account.address && account.connector?.id !== 'ghostpay-local', connecting: connection.isPending };
}
