import type { Address } from 'viem';
export const claimTypes = {
  ClaimAuthorization: [
    { name: 'paymentId', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;
export const claimDomain = (chainId: number, verifyingContract: Address) => ({ name: 'GhostPay', version: '1', chainId, verifyingContract } as const);
export const requestMessage = (chainId: number, contract: string, paymentId: string, recipient: string, timestamp: number) =>
  `GhostPay claim request\nChain: ${chainId}\nContract: ${contract.toLowerCase()}\nPayment: ${paymentId}\nRecipient: ${recipient.toLowerCase()}\nTimestamp: ${timestamp}`;
export const rejectMessage = (requestId: string, chainId: number, contract: string) =>
  `GhostPay reject request\nRequest: ${requestId}\nChain: ${chainId}\nContract: ${contract.toLowerCase()}`;
