import { useAccount, useConnect } from 'wagmi';
import type { Address, EIP1193Provider } from 'viem';
import { testnetWallet } from './native';
export function useNativeWallet(networkId: number) {
  const account = useAccount(); const connection = useConnect();
  async function wallet() {
    let connector = account.connector; let address = account.address;
    if (!connector || !address || connector.id === 'ghostpay-local') {
      connector = connection.connectors.find(item => item.id !== 'ghostpay-local');
      if (!connector) throw new Error('Install MetaMask to use EVM network payments.');
      const result = await connection.connectAsync({ connector, chainId: networkId }); address = result.accounts[0] as Address;
    }
    const provider = await connector.getProvider() as EIP1193Provider;
    if (!provider?.request) throw new Error('The connected wallet has no EVM provider.');
    return testnetWallet(networkId, provider, address);
  }
  return { ...account, wallet, external: !!account.address && account.connector?.id !== 'ghostpay-local', connecting: connection.isPending };
}
