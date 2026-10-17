import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useReadContract } from 'wagmi';
import { chain, contractAddress, escrowAbi, deployed } from '../config/web3';
import { chainNow } from '../../../shared/clock';
export function useChainTime() {
  const client = usePublicClient({ chainId: chain.id });
  return useQuery({ queryKey: ['chain-time'], queryFn: async () => chainNow(await client!.getBlock()), refetchInterval: 12000, enabled: !!client });
}
export function usePayment(id: bigint) {
  return useReadContract({ address: contractAddress, abi: escrowAbi, functionName: 'getPayment', args: [id], chainId: chain.id, query: { enabled: deployed && id > 0n, refetchInterval: 12000 } });
}
