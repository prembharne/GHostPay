import { randomUUID } from 'node:crypto';
import type { Address, Hex } from 'viem';
export interface ClaimRequest {
  id: string; paymentId: string; chainId: number; contract: Address; recipient: Address;
  status: 'pending' | 'authorized' | 'rejected'; createdAt: number; deadline?: string; signature?: Hex;
}
export class RequestStore {
  records = new Map<string, ClaimRequest>();
  create(input: Pick<ClaimRequest, 'paymentId' | 'chainId' | 'contract' | 'recipient'>) {
    const existing = this.list(input.paymentId).find(r => r.recipient.toLowerCase() === input.recipient.toLowerCase());
    if (existing) return existing;
    if (this.records.size >= 10000) throw new Error('Relay capacity reached. Restart the local demo relay.');
    const request: ClaimRequest = { ...input, id: randomUUID(), status: 'pending', createdAt: Date.now() };
    this.records.set(request.id, request); return request;
  }
  list(paymentId: string) { return [...this.records.values()].filter(r => r.paymentId === paymentId); }
}
