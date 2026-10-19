import { useState, type FormEvent } from 'react';
import { ArrowRight, Globe2, KeyRound, LoaderCircle, LockKeyhole, Server, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { MessagingSetupHelp } from './SetupHelp';
import { discoverServer, passwordLogin, startSso } from './matrix';
import { useMessenger } from './MessengerContext';

export function ConnectDialog({ onClose }: { onClose: () => void }) {
  const chat = useMessenger(); const [server, setServer] = useState(chat.server); const [discovery, setDiscovery] = useState<Awaited<ReturnType<typeof discoverServer>>>();
  const [user, setUser] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function discover(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { setDiscovery(await discoverServer(server)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function login(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const session = await passwordLogin(discovery!.homeserver, user, password); setPassword(''); await chat.connect(session); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const google = discovery?.sso?.identity_providers?.find(provider => provider.brand === 'google' || /google/i.test(provider.name));
  return <Modal title="Your people. Your server." eyebrow="CONNECT YOUR MESSAGING ACCOUNT" onClose={() => { if (!busy) onClose(); }}>
    <p className="ms-modal-copy">An encrypted home for your conversations. Connect a Matrix account to start messaging across devices.</p>
    {!discovery ? <form onSubmit={discover} className="ms-form"><label htmlFor="matrix-server">Matrix homeserver</label><div className="ms-input-icon"><Server size={17}/><input id="matrix-server" type="url" placeholder="https://matrix.your-domain.com" value={server} onChange={e => setServer(e.target.value)} autoComplete="url" required /></div><button className="ms-button ms-primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>}Find my sign-in options</button><p className="ms-fine">Your server administrator provides this address. A server is not configured for this GhostPay release yet.</p></form> : <>
      <div className="ms-server-found"><Globe2 size={18}/><div><strong>Server found</strong><span>{discovery.homeserver}</span></div><button className="ms-text" onClick={() => setDiscovery(undefined)}>Change</button></div>
      {discovery.sso && <button className="ms-button ms-primary ms-full" onClick={() => startSso(discovery.homeserver, google?.id)}><KeyRound size={17}/>{google ? 'Continue with Google' : 'Continue with your identity provider'}<ArrowRight size={17}/></button>}
      {discovery.password && <form onSubmit={login} className="ms-form"><label htmlFor="matrix-user">Matrix username</label><input id="matrix-user" value={user} onChange={e => setUser(e.target.value)} placeholder="@you:your-domain.com" autoComplete="username" required/><label htmlFor="matrix-password">Password</label><input id="matrix-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required/><button className="ms-button ms-secondary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin"/> : <LockKeyhole size={17}/>}Sign in securely</button></form>}
      {!discovery.password && !discovery.sso && <p className="ms-alert">This server does not offer a supported sign-in method. Ask its administrator about SSO.</p>}
    </>}
    {!discovery && <MessagingSetupHelp/>}
    {error && <p className="ms-alert" role="alert">{error}</p>}
    <div className="ms-modal-note"><ShieldCheck size={18}/><span>Messaging and payment signing are separate. Your Ethereum private key is never sent to the messaging server.</span></div>
    <button className="ms-text ms-preview-action" onClick={onClose}>Keep exploring the local preview<ArrowRight size={14}/></button>
  </Modal>;
}
