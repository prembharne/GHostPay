import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Ghost, Link2, ShieldCheck, Sparkle, X } from 'lucide-react';
import { Wallet } from '../components/Wallet';
import { ParticleBackground } from '../components/ParticleBackground';
import '../landing.css';

type Panel = 'benefits' | 'how-it-works' | 'faqs' | null;
const delay = (value: string): CSSProperties => ({ '--d': value } as CSSProperties);

const information = {
  benefits: {
    eyebrow: 'A LINK. A WALLET. YOUR APPROVAL.',
    title: 'Less friction. More control.',
    items: [
      ['Send before you know the address.', 'Deposit ETH into the escrow and share a payment link. The recipient connects their own wallet later.'],
      ['A copied link cannot claim.', 'Your EIP-712 approval is bound to a specific wallet, payment, contract, network, and deadline. Only that wallet can claim.'],
      ['Unclaimed funds can come back.', 'After expiry, the original sender can refund the full unclaimed deposit. GhostPay charges no protocol fee; network gas still applies.'],
    ],
  },
  'how-it-works': {
    eyebrow: 'FROM YOUR WALLET TO THEIRS',
    title: 'Three steps. One payment link.',
    items: [
      ['01 — Create & share', 'Connect MetaMask, deposit Sepolia test ETH, choose an expiry, and share the link generated from your confirmed transaction.'],
      ['02 — Verify & approve', 'The recipient connects a wallet and requests a claim. Verify the person and their full wallet address through an independent channel, then sign a gas-free approval.'],
      ['03 — Claim, or refund', 'The approved recipient claims on-chain and pays network gas. If the payment expires unclaimed, the sender can refund it from My payments.'],
    ],
  },
  faqs: {
    eyebrow: 'GOOD TO KNOW BEFORE YOU SEND',
    title: 'A few things, made clear.',
    items: [
      ['Can anyone with the link take my ETH?', 'No. A link only identifies a payment. Withdrawing requires a valid sender signature for the exact recipient wallet, and that wallet must submit the claim.'],
      ['Is this anonymous or audited?', 'Neither. Payments and wallet addresses are visible on-chain. This experimental hackathon build is not audited. Use Sepolia test ETH only.'],
      ['What if the recipient never claims?', 'The original sender can refund after the on-chain expiry. Approvals cannot be revoked before their deadline. Verify carefully before signing.'],
      ['What does it cost?', 'GhostPay has no protocol fees. Deposits, claims, and refunds require network gas. Sender approval is a signature, without a gas transaction.'],
    ],
  },
};

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(() => {
    const section = window.location.hash.slice(1);
    if (section === 'security') return 'faqs';
    return section === 'benefits' || section === 'how-it-works' || section === 'faqs' ? section : null;
  });
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('gp-home-active');
    const previousTitle = document.title;
    document.title = 'GhostPay — Send crypto. Stay in control.';
    const media = window.matchMedia('(max-width: 900px)');
    const resize = () => { setMobile(media.matches); if (!media.matches) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); burgerRef.current?.focus(); }
    };
    media.addEventListener('change', resize);
    document.addEventListener('keydown', escape);
    const elements = [...(rootRef.current?.querySelectorAll<HTMLElement>('.gp-appear, .gp-photo') || [])];
    const finish = (event: AnimationEvent) => {
      if (event.target instanceof HTMLElement && elements.includes(event.target)) event.target.classList.add('gp-is-in');
    };
    elements.forEach(element => element.addEventListener('animationend', finish));
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        for (const element of elements) {
          if (!element.getAnimations().some(animation => ['running', 'finished'].includes(animation.playState))) element.classList.add('gp-is-in');
        }
      });
    });
    return () => {
      document.body.classList.remove('gp-home-active', 'gp-menu-open');
      document.title = previousTitle;
      media.removeEventListener('change', resize);
      document.removeEventListener('keydown', escape);
      elements.forEach(element => element.removeEventListener('animationend', finish));
      cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('gp-menu-open', menuOpen);
    if (menuOpen) rootRef.current?.querySelector<HTMLAnchorElement>('.gp-nav a')?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (panel) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [panel]);

  function openPanel(event: React.MouseEvent<HTMLAnchorElement>, name: Exclude<Panel, null>) {
    event.preventDefault(); setMenuOpen(false); setPanel(name);
  }

  return (
    <div className="gp-home" id="top" ref={rootRef}>
      <a className="skip-link" href="#gp-main">Skip to content</a>
      <div className="gp-grain" aria-hidden="true" />
      <div className="gp-photo" aria-hidden="true" />
      <ParticleBackground />
      <div className="gp-frame">
        <div className={`gp-menu-backdrop${menuOpen ? ' is-open' : ''}`} aria-hidden="true" onClick={() => setMenuOpen(false)} />
        <header className="gp-header">
          <Link className="gp-logo gp-appear gp-appear--scale" style={delay('.08s')} to="/" aria-label="GhostPay home">
            <Ghost className="gp-logo-mark" aria-hidden="true" strokeWidth={1.9} />
            <span>Ghost<span className="gp-logo-suffix">Pay</span></span>
          </Link>
          <nav id="site-nav" className={`gp-nav${menuOpen ? ' is-open' : ''}`} aria-label="Primary" inert={mobile && !menuOpen ? true : undefined}>
            <a href="#benefits" className="gp-nav-pill gp-appear gp-appear--scale" style={delay('.16s')} onClick={event => openPanel(event, 'benefits')}>Benefits</a>
            <a href="#how-it-works" className="gp-nav-pill gp-appear gp-appear--soft" style={delay('.28s')} onClick={event => openPanel(event, 'how-it-works')}>How it works</a>
            <a href="#faqs" className="gp-nav-pill gp-appear gp-appear--scale" style={delay('.40s')} onClick={event => openPanel(event, 'faqs')}>FAQs</a>
            <Link to="/chat" className="gp-nav-pill gp-appear gp-appear--soft" style={delay('.52s')} onClick={() => setMenuOpen(false)}>Messenger</Link>
          </nav>
          <div className="gp-header-wallet gp-appear gp-appear--scale" style={delay('.34s')}><Wallet /></div>
          <button ref={burgerRef} type="button" className="gp-burger gp-appear gp-appear--scale" style={delay('.34s')} aria-controls="site-nav" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
        </header>

        <main className="gp-hero" id="gp-main">
          <div className="gp-copy">
            <div className="gp-badge gp-appear gp-appear--pop" style={delay('.22s')}><Sparkle className="gp-badge-star" size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />Wallet-bound ETH payments</div>
            <h1>
              <span className="gp-headline-line"><span className="gp-appear gp-appear--mask" style={delay('.42s')}>Send <em>crypto</em> with a link.</span></span>
              <span className="gp-headline-line"><span className="gp-appear gp-appear--mask" style={delay('.62s')}>Stay in control, every time.</span></span>
            </h1>
            <p className="gp-lede gp-appear gp-appear--soft" style={{ ...delay('.82s'), animationDuration: '1.25s' }}>Send ETH without a recipient address upfront.<br className="gp-desktop-break" /> Share a link. Approve their wallet. Let them claim.</p>
            <div className="gp-actions">
              <Link className="gp-btn gp-btn-solid gp-appear gp-appear--btn" style={delay('.96s')} to="/chat">Open messenger</Link>
              <Link className="gp-btn gp-btn-ghost gp-appear gp-appear--side" style={delay('1.10s')} to="/dashboard">View my payments</Link>
            </div>
          </div>
        </main>

        <footer className="gp-stats" aria-label="Payment details">
          <div className="gp-stat gp-appear gp-appear--stat" style={delay('1.12s')}><Link2 size={20} strokeWidth={1.65} aria-hidden="true" /><span>No recipient address upfront</span></div>
          <div className="gp-stat gp-appear gp-appear--stat" style={delay('1.28s')}><ShieldCheck size={20} strokeWidth={1.65} aria-hidden="true" /><span>EIP-712 wallet-bound approval</span></div>
          <div className="gp-stat gp-appear gp-appear--stat" style={delay('1.44s')}><Clock3 size={20} strokeWidth={1.65} aria-hidden="true" /><span>Sepolia testnet · test funds only</span></div>
        </footer>
      </div>

      <dialog className="gp-dialog" ref={dialogRef} aria-labelledby="gp-dialog-title" onClose={() => setPanel(null)} onClick={event => { if (event.target === event.currentTarget) setPanel(null); }}>
        {panel && <div className="gp-dialog-content">
          <button className="gp-dialog-close" aria-label="Close information" onClick={() => setPanel(null)}><X size={20} aria-hidden="true" /></button>
          <p className="gp-dialog-eyebrow">{information[panel].eyebrow}</p>
          <h2 id="gp-dialog-title">{information[panel].title}</h2>
          <div className="gp-dialog-items">{information[panel].items.map(([title, content]) => <div key={title}><h3>{title}</h3><p>{content}</p></div>)}</div>
          <Link className="gp-btn gp-btn-solid" to="/create">Create a payment</Link>
        </div>}
      </dialog>
    </div>
  );
}
