import type { Address, Hex } from 'viem';
export interface ClaimRequest { id: string; paymentId: string; recipient: Address; status: 'pending'|'authorized'|'rejected'; createdAt: number; deadline?: string; signature?: Hex }
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({ error: 'Relay unavailable. Start the backend server.' }));
  if (!res.ok || data.error) throw new Error(data.error || 'Relay request failed.'); return data;
}
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const linkFor = (id: string | bigint) => `${window.location.origin}/pay/${id}`;
export const date = (seconds: bigint) => new Date(Number(seconds) * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function friendlyError(e: unknown) { const err = e as {shortMessage?: string; message?: string}; const s = err.shortMessage || err.message || 'Something went wrong. Please retry.'; return /User rejected|User denied/i.test(s) ? 'Request cancelled in your wallet. You can try again.' : s.slice(0, 300); }
