import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { Ghost, Plus, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { nativeReference, nativePath, requireTestnet } from '../../../shared/nativeProtocol';
import { nativeHistory } from './native';
import { NativeComposer } from './NativeComposer';
import NativePaymentPage from './NativePaymentPage';
import { ParticleBackground } from '../components/ParticleBackground';
import './payments.css';
export function NativeHistory({ embedded = false }: { embedded?: boolean }) {
  const entries = nativeHistory().filter(item => nativeReference(item));
  return <section className={`gp-native-history${embedded ? ' is-embedded' : ' page'}`}><div className="gp-native-history-title"><div><p className="ms-kicker">NATIVE COINS · EVM TESTNETS</p><h2>Payments across <em>your networks.</em></h2><p>Links saved on this device. Open a payment to verify its current on-chain state.</p></div><Link className="button primary" to="/create"><Plus size={16}/>Create payment</Link></div>
    {!entries.length ? <div className="panel empty"><Ghost size={31}/><h3>Your next network starts here.</h3><p>Create a native-coin escrow payment or open a payment link someone shared with you.</p></div> : <div className="gp-native-history-list">{entries.map(item => { const network = requireTestnet(item.chainId); return <Link className="panel" key={`${item.chainId}/${item.contract}/${item.paymentId}`} to={nativePath(item)}><span className="gp-coin-mark">{network.symbol.slice(0, 1)}</span><span><strong>Payment #{item.paymentId} · {network.symbol}</strong><small>{network.name}</small><code>{item.contract}</code></span><ArrowUpRight size={17}/></Link>; })}</div>}
    <Link className="text-button" to="/dashboard">Original Sepolia escrow dashboard<ArrowUpRight size={14}/></Link>
  </section>;
}
export default function NativeRoutes() {
  const navigate = useNavigate();
  return <div className="workspace gp-native-workspace"><div className="workspace-photo" aria-hidden="true"/><ParticleBackground/><div className="app-shell"><header className="workspace-header"><Link className="gp-logo" to="/"><Ghost className="gp-logo-mark"/><span>Ghost<span className="gp-logo-suffix">Pay</span></span></Link><nav className="workspace-nav" aria-label="Payment navigation"><Link className="gp-nav-pill" to="/chat">Messenger</Link><Link className="gp-nav-pill" to="/create">Create payment</Link><Link className="gp-nav-pill" to="/payments">Native payments</Link></nav><span className="gp-testnet-tag gp-header-wallet">TESTNETS ONLY</span></header><div className="network-bar"><span><ShieldCheck size={13}/>EVM native-coin escrow</span><span>No mainnet transfers · No bridging</span></div><main id="main"><Routes><Route path="/create" element={<div className="gp-native-create-page"><NativeComposer standalone onClose={() => navigate('/payments')}/></div>}/><Route path="/payments" element={<NativeHistory/>}/><Route path="/pay/v2/:chainId/:contract/:paymentId" element={<NativePaymentPage/>}/></Routes></main></div></div>;
}
