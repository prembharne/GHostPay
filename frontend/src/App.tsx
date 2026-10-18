import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, Ghost, ShieldCheck, CircleHelp } from 'lucide-react';
import { Wallet } from './components/Wallet';
import { ParticleBackground } from './components/ParticleBackground';
import { Landing } from './pages/Landing';
import { CreatePayment } from './pages/CreatePayment';
import { PaymentPage } from './pages/PaymentPage';
import { Dashboard } from './pages/Dashboard';
import { Setup } from './pages/Setup';
import { deployed } from './config/web3';
import { lazy, Suspense } from 'react';
const Messenger = lazy(() => import('./messenger/Messenger'));
const WalletApprovalHost = lazy(() => import('./wallet/WalletDialog').then(module => ({ default: module.WalletApprovalHost })));

export default function App() { return <><Suspense fallback={null}><WalletApprovalHost/></Suspense><AppRoutes/></>; }
function AppRoutes() {
  const { pathname } = useLocation();
  if (pathname === '/') return <Landing />;
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#080809', color: '#bdbdc4', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Opening your conversations…</div>}><Messenger/></Suspense>;

  return <div className="workspace">
    <div className="workspace-photo" aria-hidden="true" />
    <ParticleBackground />
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="workspace-header">
        <Link className="gp-logo" to="/" aria-label="GhostPay home">
          <Ghost className="gp-logo-mark" aria-hidden="true" strokeWidth={1.9} />
          <span>Ghost<span className="gp-logo-suffix">Pay</span></span>
        </Link>
        <nav className="workspace-nav" aria-label="Main navigation">
          <NavLink className="gp-nav-pill" to="/chat">Messenger</NavLink>
          <NavLink className="gp-nav-pill" to="/" end>Overview</NavLink>
          <NavLink className="gp-nav-pill" to="/create">Create payment</NavLink>
          <NavLink className="gp-nav-pill" to="/dashboard">My payments</NavLink>
        </nav>
        <div className="gp-header-wallet"><Wallet /></div>
      </header>
      <div className="network-bar">
        <span><span className="network-dot" />Ethereum Sepolia <span className="mono muted">11155111</span></span>
        <span><ShieldCheck size={13} aria-hidden="true" />Test network · Test funds only</span>
      </div>
      <main id="main">
        {!deployed && pathname !== '/setup' && <div className="feedback neutral setup-banner"><ShieldCheck size={16} /><span>Deploy the escrow on Sepolia to start sending.</span><Link className="text-button" to="/setup">Set up GhostPay<ArrowUpRight size={15} /></Link></div>}
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/create" element={<CreatePayment />} />
          <Route path="/pay/:paymentId" element={<PaymentPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<div className="page empty">
            <Ghost size={40} /><h1>This link wandered off.</h1>
            <Link className="button primary" to="/">Back to home <ArrowUpRight size={17} /></Link>
          </div>} />
        </Routes>
      </main>
      <footer className="workspace-footer">
        <Link className="gp-logo" to="/" aria-label="GhostPay home">
          <Ghost size={20} aria-hidden="true" /><span>Ghost<span className="gp-logo-suffix">Pay</span></span>
        </Link>
        <p>Less friction. More control.</p>
        <div>
          <a href="/#how-it-works"><CircleHelp size={14} aria-hidden="true" />How it works</a>
          <a href="/#security"><ShieldCheck size={14} aria-hidden="true" />Security</a>
          <span>Test funds only · Not audited</span>
        </div>
      </footer>
    </div>
  </div>;
}
