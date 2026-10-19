import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
export interface GhostProfile { username: string; wallet: Address; createdAt: number }
export function username(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Enter a GhostPay username.');
  const name = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(name)) throw new Error('Use 3–24 letters, numbers or underscores, starting with a letter.');
  if (['admin','administrator','support','security','ghostpay','system','walletconnect','reown','google'].includes(name)) throw new Error('That username is reserved.');
  return name;
}
export function profileMessage(wallet: string, requested: string, timestamp: number, nonce: string) {
  if (!isAddress(wallet) || wallet.toLowerCase() === zeroAddress || !Number.isSafeInteger(timestamp) || !/^[a-f0-9]{32}$/.test(nonce)) throw new Error('Invalid wallet registration proof.');
  const name = requested ? username(requested) : 'automatic';
  return `GhostPay profile registration v1\nApplication: ghostpay-lac.vercel.app\nWallet: ${getAddress(wallet)}\nUsername: ${name}\nIssued at: ${timestamp}\nNonce: ${nonce}\nThis creates a public username linked permanently to this wallet. It does not authorize a payment.`;
}
