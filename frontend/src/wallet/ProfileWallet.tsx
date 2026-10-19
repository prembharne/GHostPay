import { useEffect, useState } from 'react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Copy, Globe2, LoaderCircle, LogOut, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { Modal } from '../messenger/Modal';
import { openWalletAccount } from '../config/reown';
import { profileMessage } from '../../../shared/identity';
import { requireTestnet } from '../../../shared/nativeProtocol';
import { useNativeWallet } from '../payments/useNativeWallet';
import { profileApi, useProfile } from '../payments/identity';
import { useAction } from '../hooks/useAction';
import '../messenger/messenger.css';
import '../payments/payments.css';
import './profile.css';
export function ProfileButton() { const [open, setOpen] = useState(false); return <><button className="gp-profile-trigger" aria-label="Your profile and wallet" onClick={() => setOpen(true)}><UserRound size={18}/><span>My wallet</span></button>{open && <ProfileWallet onClose={() => setOpen(false)}/>}</>; }
export default function ProfileWallet({ onClose }: { onClose(): void }) {
  const account = useAccount(); const { disconnect } = useDisconnect(); const profile = useProfile(account.address); const queryClient = useQueryClient(); const action = useAction();
  const networkId = account.chainId && (() => { try { requireTestnet(account.chainId); return true; } catch { return false; } })() ? account.chainId : 11155111;
  const wallet = useNativeWallet(networkId); const network = requireTestnet(networkId);
  const balance = useBalance({ address: account.address, chainId: networkId, query: { enabled: !!account.address, refetchInterval: 15000 } });
  const [name, setName] = useState(''); const [copied, setCopied] = useState(false);
  useEffect(() => { setName(''); setCopied(false); }, [account.address]);
  async function register(automatic = false) { await action.run(async () => {
    const signer = await wallet.wallet(); const address = signer.account.address;
    const timestamp = Math.floor(Date.now() / 1000); const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const requested = automatic ? '' : name;
    const signature = await signer.signMessage({ message: profileMessage(address, requested, timestamp, nonce) });
    await profileApi('', { wallet: address, username: requested, timestamp, nonce, signature });
    await queryClient.invalidateQueries({ queryKey: ['ghost-profile', address.toLowerCase()] }); action.setNotice('Your username is ready. People can pay you without typing your address.');
  }); }
  async function copy() { try { await navigator.clipboard.writeText(profile.data ? `@${profile.data.username}` : account.address!); setCopied(true); } catch { action.setError('Clipboard unavailable. Copy the displayed name or address.'); } }
  return <Modal title={profile.data ? `@${profile.data.username}` : 'Your corner of GhostPay.'} eyebrow="PROFILE & WALLET" onClose={() => { if (!action.busy) onClose(); }}>
    <div className="gp-profile-orb"><UserRound size={29}/></div>
    <p className="ms-modal-copy">One familiar name. Your own wallet. Payments and communities, connected.</p>
    {!account.address ? <><button className="ms-button ms-primary ms-full" onClick={() => { void action.run(async () => { await openWalletAccount(); }); }}><Globe2 size={17}/>Continue with Google or a wallet<ArrowUpRight size={17}/></button><p className="ms-fine">Reown provisions or reconnects your embedded wallet after Google sign-in. Your private key is not stored by GhostPay. This wallet login does not sign you into a Matrix chat server.</p></> : <>
      <div className="gp-profile-balance"><span>YOUR TESTNET BALANCE · {network.symbol}</span><strong>{balance.data ? Number(balance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <small>{network.symbol}</small></strong><p>{network.name} · test coins only</p></div>
      <div className="gp-profile-address"><Wallet size={16}/><code>{account.address}</code><button className="ms-icon" aria-label={profile.data ? 'Copy username' : 'Copy wallet address'} onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>
      {profile.isPending ? <p className="ms-fine">Looking up your username…</p> : profile.error ? <p className="ms-alert">{profile.error.message}<button className="ms-text" onClick={() => { void profile.refetch(); }}>Retry</button></p> : profile.data ? <div className="gp-profile-name"><ShieldCheck size={17}/><div><strong>@{profile.data.username}</strong><p>Registered with a signature from this wallet.</p></div></div> : <div className="ms-form gp-name-form"><label htmlFor="profile-username">Choose your unique username</label><input id="profile-username" value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/^@/, ''))} placeholder="e.g. prem_bharne" maxLength={24}/><p className="ms-fine">3–24 letters, numbers or underscores. This public name is permanently linked to this wallet through GhostPay’s directory. Registration asks for a signature, not a payment.</p><button className="ms-button ms-primary" disabled={action.busy || !name || account.connector?.id === 'ghostpay-local'} onClick={() => register()}>{action.busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>}Reserve my username</button><button className="ms-text" disabled={action.busy || account.connector?.id === 'ghostpay-local'} onClick={() => register(true)}>Assign me a unique name instead</button></div>}
      <button className="ms-button ms-secondary ms-full" onClick={() => { void action.run(openWalletAccount); }}><Wallet size={16}/>Wallet account & connection</button>
      {account.connector?.id === 'ghostpay-local' && <p className="ms-fine">The device wallet supports the original Sepolia escrow. Use Google or an external wallet for usernames, direct transfers and campaigns.</p>}
      <button className="ms-button ms-secondary ms-full" onClick={() => disconnect()}><LogOut size={16}/>Disconnect wallet</button>
    </>}
    {action.error && <p className="ms-alert" role="alert">{action.error}</p>}{action.notice && <p className="ms-fine" role="status">{action.notice}</p>}
    <div className="ms-modal-note"><ShieldCheck size={17}/><span>All payments stay on EVM testnets. You review and approve every transfer. Google wallet access and chat encryption use separate recovery systems.</span></div>
  </Modal>;
}
