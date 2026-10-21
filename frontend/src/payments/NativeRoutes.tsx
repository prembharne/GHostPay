import TradePage from '../p2p/TradePage';
import { InstallAction } from '../pwa/PwaProvider';
import { Link, NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { Ghost, Plus, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { nativeReference, nativePath, requireTestnet } from '../../../shared/nativeProtocol';
import { nativeHistory } from './native';
import { PaymentStudio } from './PaymentStudio';
import CampaignPage from './CampaignPage';
import NativePaymentPage from './NativePaymentPage';
import { ParticleBackground } from '../components/ParticleBackground';
import './payments.css';
import { directHistory } from './DirectPayment';
import { campaignHistory } from './community';
import { campaignPath } from '../../../shared/community';
import { ProfileButton } from '../wallet/ProfileWallet';
export function NativeHistory({ embedded = false }: { embedded?: boolean }) {
  const transfers = directHistory(); const campaigns = campaignHistory();
  const entries = nativeHistory().filter(item => nativeReference(item));
  return <section className={`gp-native-history${embedded ? ' is-embedded' : ' page'}`}><div className="gp-native-history-title"><div><p className="ms-kicker">NATIVE COINS · EVM TESTNETS</p><h2>Payments across <em>your networks.</em></h2><p>Links saved on this device. Open a payment to verify its current on-chain state.</p></div><Link className="button primary" to="/create"><Plus size={16}/>Create payment</Link></div>
    {!entries.length ? <div className="panel empty"><Ghost size={31}/><h3>Your next network starts here.</h3><p>Create a native-coin escrow payment or open a payment link someone shared with you.</p></div> : <div className="gp-native-history-list">{entries.map(item => { const network = requireTestnet(item.chainId); return <Link className="panel" key={`${item.chainId}/${item.contract}/${item.paymentId}`} to={nativePath(item)}><span className="gp-coin-mark">{network.symbol.slice(0, 1)}</span><span><strong>Payment #{item.paymentId} · {network.symbol}</strong><small>{network.name}</small><code>{item.contract}</code></span><ArrowUpRight size={17}/></Link>; })}</div>}
    {!!transfers.length && <><p className="ms-kicker">DIRECT TRANSFERS · SAVED ON THIS DEVICE</p><div className="gp-native-history-list">{transfers.map(ref => {const n=requireTestnet(ref.chainId);return <a className="panel" key={ref.hash} href={`${n.explorer}/tx/${ref.hash}`} target="_blank" rel="noreferrer"><span className="gp-coin-mark">{n.symbol.slice(0,1)}</span><span><strong>Direct {n.symbol} transfer</strong><small>{n.name}</small><code>{ref.to}</code></span><ArrowUpRight size={17}/></a>;})}</div></>}
    {!!campaigns.length && <><p className="ms-kicker">COMMUNITY CAMPAIGNS · SAVED ON THIS DEVICE</p><div className="gp-native-history-list">{campaigns.map(ref=><Link className="panel" key={`${ref.chainId}/${ref.contract}/${ref.campaignId}`} to={campaignPath(ref)}><span className="gp-coin-mark">C</span><span><strong>Campaign #{ref.campaignId}</strong><small>{requireTestnet(ref.chainId).name}</small></span><ArrowUpRight size={17}/></Link>)}</div></>}
    <Link className="button secondary" to="/trade">Explore INR ↔ USDC settlement<ArrowUpRight size={14}/></Link><Link className="text-button" to="/dashboard">Original Sepolia escrow dashboard<ArrowUpRight size={14}/></Link>
  </section>;
}
export default function NativeRoutes() {
  const navigate = useNavigate(); const location = useLocation();
  return <div className="workspace gp-native-workspace"><div className="workspace-photo" aria-hidden="true"/><ParticleBackground/><div className="app-shell"><header className="workspace-header"><Link className="gp-logo" to="/"><Ghost className="gp-logo-mark"/><span>Ghost<span className="gp-logo-suffix">Pay</span></span></Link><nav className="workspace-nav" aria-label="Payment navigation"><NavLink className="gp-nav-pill" to="/chat">Messenger</NavLink><NavLink className="gp-nav-pill" to="/create">Create payment</NavLink><NavLink className="gp-nav-pill" to="/payments">Payments</NavLink><NavLink className="gp-nav-pill" to="/trade">P2P exchange</NavLink></nav><div className="gp-header-wallet"><InstallAction compact/><ProfileButton/></div></header><div className="network-bar"><span><ShieldCheck size={13}/>{location.pathname === "/trade" ? "INR ↔ USDC · Settlement sandbox" : "EVM native-coin escrow"}</span><span>No mainnet transfers · No bridging</span></div><main id="main"><Routes><Route path="/trade" element={<TradePage/>}/><Route path="/create" element={<div className="gp-native-create-page"><PaymentStudio standalone recipient={typeof location.state?.community === 'string' ? location.state.community : undefined} onClose={() => navigate('/payments')}/></div>}/><Route path="/campaign/:chainId/:contract/:campaignId" element={<CampaignPage/>}/><Route path="/payments" element={<NativeHistory/>}/><Route path="/pay/v2/:chainId/:contract/:paymentId" element={<NativePaymentPage/>}/></Routes></main></div></div>;
}
