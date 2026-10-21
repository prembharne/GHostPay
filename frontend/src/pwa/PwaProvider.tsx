import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, Ghost, RefreshCw, Share, WifiOff, X } from 'lucide-react';
import './pwa.css';

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface PwaState { installed: boolean; online: boolean; openInstall(): void }
const Context = createContext<PwaState>({ installed: false, online: true, openInstall() {} });
export const usePwa = () => useContext(Context);
export function InstallAction({ compact = false }: { compact?: boolean }) {
  const pwa = usePwa();
  return pwa.installed ? null : <button className={`gp-install-action${compact ? ' is-compact' : ''}`} onClick={pwa.openInstall} aria-label="Install GhostPay app"><ArrowDownToLine size={16}/><span>Install app</span></button>;
}
export function PwaProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [update, setUpdate] = useState<ServiceWorker>(); const [dismissUpdate, setDismissUpdate] = useState(false); const [confirmUpdate, setConfirmUpdate] = useState(false);
  const prompt = useRef<InstallEvent | undefined>(undefined); const activateUpdate = useRef(false); const dialog = useRef<HTMLDialogElement>(null);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  useEffect(() => {
    const status = () => setOnline(navigator.onLine);
    const install = (event: Event) => { event.preventDefault(); prompt.current = event as InstallEvent; };
    const done = () => { setInstalled(true); setOpen(false); prompt.current = undefined; };
    window.addEventListener('online', status); window.addEventListener('offline', status);
    window.addEventListener('beforeinstallprompt', install); window.addEventListener('appinstalled', done);
    const media = window.matchMedia('(display-mode: standalone)'); const changed = () => setInstalled(media.matches);
    media.addEventListener('change', changed);
    return () => { window.removeEventListener('online', status); window.removeEventListener('offline', status); window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', done); media.removeEventListener('change', changed); };
  }, []);
  useEffect(() => { document.documentElement.style.setProperty('--gp-connection-inset', online ? '0px' : '40px'); }, [online]);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let cancelled = false; let registration: ServiceWorkerRegistration | undefined;
    const check = () => { if (registration?.waiting && navigator.serviceWorker.controller && !cancelled) setUpdate(registration.waiting); };
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {}); };
    const changed = () => { if (activateUpdate.current) window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(next => {
      if (cancelled) return; registration = next; check();
      next.addEventListener('updatefound', () => { const worker = next.installing; worker?.addEventListener('statechange', check); });
    }).catch(() => { /* Installation stays optional; the live app still works. */ });
    document.addEventListener('visibilitychange', refresh);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', refresh); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); previous?.focus(); };
  }, [open]);
  async function install() {
    if (!prompt.current) { setMessage('Use your browser’s menu to add GhostPay to your home screen. The option depends on your browser.'); return; }
    setBusy(true); setMessage('');
    try { const event = prompt.current; prompt.current = undefined; await event.prompt(); const choice = await event.userChoice; if (choice.outcome === 'accepted') setOpen(false); else setMessage('No problem. You can install GhostPay whenever you’re ready.'); }
    catch { setMessage('Open your browser’s menu and choose Install app or Add to Home Screen.'); }
    finally { setBusy(false); }
  }
  function reload() {
    activateUpdate.current = true; update?.postMessage({ type: 'ACTIVATE_UPDATE' });
  }
  return <Context.Provider value={{ installed, online, openInstall: () => { setMessage(''); setOpen(true); } }}>
    {!online && <div className="gp-offline-bar" role="status"><WifiOff size={14}/><span>Offline · reconnect for messages & payments</span></div>}
    {children}
    {update && !dismissUpdate && <aside className={`gp-app-update${confirmUpdate ? ' gp-update-confirm' : ''}`} aria-label="App update"><RefreshCw size={17}/><span aria-live="polite"><strong>{confirmUpdate ? 'Ready to reload?' : 'A fresh GhostPay is ready.'}</strong><small>{confirmUpdate ? 'Save payment links and transaction hashes first. Unsaved form entries and message drafts will be lost.' : 'Update when your current task is finished.'}</small></span><div className="gp-update-actions">{confirmUpdate ? <><button onClick={reload}>Reload now</button><button className="gp-update-later" onClick={() => setConfirmUpdate(false)}>Keep working</button></> : <button onClick={() => setConfirmUpdate(true)}>Update</button>}</div><button className="gp-update-close" aria-label="Dismiss update reminder" onClick={() => { setDismissUpdate(true); setConfirmUpdate(false); }}><X size={16}/></button></aside>}
    {open && <dialog ref={dialog} className="gp-install-dialog" aria-labelledby="gp-install-title" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }} onClick={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><div className="gp-install-body"><button className="gp-install-close" aria-label="Close installation guide" disabled={busy} onClick={() => setOpen(false)}><X size={20}/></button><div className="gp-install-mark"><Ghost size={33} strokeWidth={1.5}/></div><p className="gp-install-eyebrow">A LITTLE CLOSER, EVERY DAY</p><h2 id="gp-install-title">Your people.<br/><em>A tap away.</em></h2><p className="gp-install-copy">Keep GhostPay on your home screen. The same conversations and payment links, in a space of their own.</p><div className="gp-install-benefits"><span><Check size={15}/>Opens in its own app window</span><span><Check size={15}/>No app-store download</span><span><Check size={15}/>Public app shell available offline</span></div>{isIos ? <ol className="gp-install-steps"><li>Open this page in Safari.</li><li>Tap <Share size={14}/> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</li><li>Choose <strong>Open as Web App</strong> if offered, then Add.</li></ol> : <><button className="gp-install-primary" disabled={busy} onClick={() => void install()}><ArrowDownToLine size={18}/>{busy ? 'Opening installation…' : 'Install GhostPay'}<ArrowUpRight size={16}/></button><p className="gp-install-hint">If no prompt appears, use your browser menu → Install app or Add to Home Screen.</p></>}{message && <p className="gp-install-feedback" role="status">{message}</p>}<p className="gp-install-note">Live messaging and blockchain actions need internet. GhostPay never queues payments for automatic submission.</p><button className="gp-install-later" disabled={busy} onClick={() => setOpen(false)}>Maybe later</button></div></dialog>}
  </Context.Provider>;
}
