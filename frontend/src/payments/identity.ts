import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
import { username, type GhostProfile } from '../../../shared/identity';
export async function profileApi(path: string, body?: unknown): Promise<any> {
  const response = await fetch(`/api/profiles${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), cache: 'no-store' });
  const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Username service unavailable.'); return value;
}
export const useProfile = (address?: Address) => useQuery<GhostProfile | null>({ queryKey: ['ghost-profile', address?.toLowerCase()], queryFn: () => profileApi(`/address/${address}`), enabled: !!address, staleTime: 15000 });
export async function resolveRecipient(input: string): Promise<{ address: Address; label: string }> {
  const value = input.trim();
  if (isAddress(value)) { if (value.toLowerCase() === zeroAddress) throw new Error('The zero address cannot receive a payment.'); return { address: getAddress(value), label: 'Wallet address' }; }
  const name = username(value); const profile: GhostProfile | null = await profileApi(`/name/${name}`);
  if (!profile || profile.username !== name || !isAddress(profile.wallet)) throw new Error('That username is not registered. Ask the recipient to open their profile wallet.');
  return { address: getAddress(profile.wallet), label: `@${profile.username}` };
}

export async function resolveRecipients(inputs: string[]) {
 const names=[...new Set(inputs.filter(value=>!isAddress(value.trim())).map(value=>username(value)))];
 const profiles:GhostProfile[]=names.length?await profileApi('/resolve',{usernames:names}):[];
 return inputs.map(input=>{const value=input.trim();if(isAddress(value)){if(value.toLowerCase()===zeroAddress)throw new Error('The zero address cannot receive an allocation.');return {address:getAddress(value),label:'Wallet address'};}const name=username(value);const profile=profiles.find(p=>p.username===name);if(!profile||!isAddress(profile.wallet))throw new Error(`@${name} is not registered.`);return {address:getAddress(profile.wallet),label:`@${name}`};});
}
