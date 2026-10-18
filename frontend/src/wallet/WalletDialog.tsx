import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { ArrowRight, Check, Copy, Download, ExternalLink, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Upload, Wallet as WalletIcon } from 'lucide-react';
import { Modal } from '../messenger/Modal';
import { answerApproval, createVault, exportVault, importVault, lockVault, setVaultOwner, subscribeVault, unlockVault, vaultSnapshot } from './vault';
import { explorer } from '../config/web3';
import '../messenger/messenger.css';
import './wallet.css';

export default function WalletDialog({ onClose }: { onClose: () => void }) {
  const vault = useSyncExternalStore(subscribeVault, vaultSnapshot); const { address, connector } = useAccount(); const { connectAsync, connectors } = useConnect(); const { disconnect } = useDisconnect();
  const [tab, setTab] = useState<'wallet' | 'import'>('wallet'); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [backup, setBackup] = useState(''); const [backedUp, setBackedUp] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false); const file = useRef<HTMLInputElement>(null);
  useEffect(() => { setVaultOwner(vault.owner); }, []);
  async function connectLocal(e: FormEvent) { e.preventDefault(); setError(''); setBusy(true); try {
    if (!vault.exists && tab !== 'import' && password !== confirmation) throw new Error('The wallet passwords do not match.');
    if (tab === 'import') await importVault(backup, password); else if (vault.exists) await unlockVault(password); else await createVault(password);
    setPassword(''); setConfirmation(''); setBackup('');
    const local = connectors.find(c => c.id === 'ghostpay-local'); if (!local) throw new Error('Wallet connector is unavailable.'); await connectAsync({ connector: local });
  } catch (e) { const text = (e as Error).message; setError(/password|decrypt|invalid json|scrypt|keystore/i.test(text) ? 'Could not unlock this wallet. Check your password and backup file.' : text.slice(0, 180)); } finally { setBusy(false); } }
  async function metamask() { setError(''); setBusy(true); try { const target = connectors.find(c => c.id !== 'ghostpay-local'); if (!target) throw new Error('Install MetaMask to use an external wallet.'); await connectAsync({ connector: target }); onClose(); } catch (e) { setError(/User rejected|User denied/i.test((e as Error).message) ? 'Connection cancelled. You can try again.' : 'Could not connect MetaMask. Check that the extension is installed and unlocked.'); } finally { setBusy(false); } }
  function download() { try { const data = exportVault(); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ghostpay-encrypted-wallet-${vault.address?.slice(2, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setBackedUp(true); } catch (e) { setError((e as Error).message); } }
  const unlocked = vault.unlocked && connector?.id === 'ghostpay-local';
  return <Modal title={unlocked ? 'Your wallet. Yours alone.' : vault.exists ? 'Welcome back, wallet.' : 'A wallet, without the extension.'} eyebrow="SELF-CUSTODIAL · SEPOLIA TESTNET" onClose={() => { if (!busy && !vault.busy) onClose(); }}>
    {unlocked ? <>
      <p className="ms-modal-copy">Your signing key is unlocked on this device. Every payment and signature still asks for your confirmation.</p>
      <div className="gw-address"><WalletIcon size={20}/><code>{address}</code><button className="ms-icon" aria-label="Copy wallet address" onClick={async () => { await navigator.clipboard.writeText(address!); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div>
      <div className="ms-modal-note"><KeyRound size={18}/><span>Download your encrypted backup and keep its password separately. Google sign-in cannot recover this wallet or its funds. Clearing browser data without a backup loses access.</span></div>
      <button className="ms-button ms-primary ms-full" onClick={download}><Download size={16}/>{backedUp ? 'Download backup again' : 'Download encrypted backup'}</button>
      <a className="ms-text gw-explorer" href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer">View your testnet address<ExternalLink size={13}/></a>
      <button className="ms-button ms-secondary ms-full" onClick={() => { lockVault(); disconnect(); }}><LockKeyhole size={16}/>Lock wallet</button>
      <p className="ms-fine">Automatically locks five minutes after the last wallet operation. Switching messaging profiles also locks it.</p>
    </> : <>
      <p className="ms-modal-copy">{vault.exists ? 'Unlock your encrypted wallet on this device. Your password stays here.' : 'Create a wallet on your device. Its private key is randomly generated and encrypted with your password before it is saved.'}</p>
      {!vault.exists && <div className="ms-segments"><button className={tab === 'wallet' ? 'selected' : ''} onClick={() => setTab('wallet')}><PlusWallet/>Create wallet</button><button className={tab === 'import' ? 'selected' : ''} onClick={() => setTab('import')}><Upload size={15}/>Import backup</button></div>}
      <form className="ms-form" onSubmit={connectLocal}>
        {tab === 'import' && !vault.exists && <><input ref={file} type="file" accept="application/json,.json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 100000) { setError('Choose a wallet backup smaller than 100 KB.'); return; } setBackup(await f.text()); }}/><button type="button" className="ms-button ms-secondary" onClick={() => file.current?.click()}><Upload size={15}/>{backup ? 'Encrypted backup selected' : 'Choose encrypted wallet backup'}</button></>}
        <label htmlFor="wallet-password">{vault.exists || tab === 'import' ? 'Wallet password' : 'Create a wallet password'}</label><input id="wallet-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={vault.exists || tab === 'import' ? 'current-password' : 'new-password'} minLength={vault.exists || tab === 'import' ? 1 : 12} placeholder={vault.exists ? 'Your wallet password' : 'At least 12 characters'} required/>
        {!vault.exists && tab === 'wallet' && <><label htmlFor="wallet-confirmation">Confirm wallet password</label><input id="wallet-confirmation" type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" required minLength={12}/></>}
        {error && <p className="ms-alert" role="alert">{error}</p>}
        <button className="ms-button ms-primary" disabled={busy || vault.busy || tab === 'import' && !backup}>{busy || vault.busy ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>} {busy || vault.busy ? `Securing your wallet… ${Math.round(vault.progress * 100)}%` : vault.exists ? 'Unlock this wallet' : tab === 'import' ? 'Import & unlock wallet' : 'Create my wallet'}</button>
      </form>
      <div className="ms-modal-note"><ShieldCheck size={18}/><span>Testnet-only, experimental wallet. The app’s JavaScript can access your key while unlocked. Keep your device secure and never use this build for mainnet funds.</span></div>
      <div className="gw-or"><span/>OR USE YOUR EXISTING WALLET<span/></div><button className="ms-button ms-secondary ms-full" onClick={metamask} disabled={busy || vault.busy}>Connect MetaMask<ArrowRight size={16}/></button>
      {address && <button className="ms-text ms-preview-action" onClick={onClose}>Keep current wallet</button>}
    </>}
  </Modal>;
}
function PlusWallet() { return <WalletIcon size={15}/>; }

export function WalletApprovalHost() {
  const state = useSyncExternalStore(subscribeVault, vaultSnapshot); const request = state.approval; if (!request) return null;
  return <Modal title={request.title} eyebrow="YOUR GHOSTPAY WALLET · CONFIRMATION REQUIRED" onClose={() => answerApproval(false)} wide>
    <p className="ms-modal-copy">{request.description}</p><dl className="gw-approval-details">{request.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="ms-inline-actions gw-approval-actions"><button className="ms-button ms-secondary" onClick={() => answerApproval(false)}>Cancel</button><button className="ms-button ms-primary" onClick={() => answerApproval(true)}>{request.kind === 'transaction' ? 'Confirm testnet transaction' : 'Confirm signature'}<Check size={16}/></button></div>
    <p className="ms-fine">Verify the full recipient, network, and action before confirming.</p>
  </Modal>;
}
