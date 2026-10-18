import { Check, Copy, ExternalLink, LoaderCircle, ShieldCheck, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { Link } from 'react-router-dom';
import { chain, deployed, deploymentIssue, explorer } from '../config/web3';
import { linkFor } from '../lib/api';
import type { useAction } from '../hooks/useAction';
export function Feedback({ action }: {action: ReturnType<typeof useAction>}) { return <>{action.error && <div className="feedback error" role="alert">{action.error}</div>}{action.notice && <div className="feedback success" role="status"><Check size={16}/>{action.notice}</div>}</>; }
export function Busy({ children }: {children: React.ReactNode}) { return <><LoaderCircle size={17} className="spin"/>{children}</>; }
export function NetworkGate() {
  const { address, chainId } = useAccount(); const { switchChain, error } = useSwitchChain();
  if (!deployed) return <div className="feedback neutral">{deploymentIssue || 'GhostPay is not deployed on Sepolia yet.'} <Link className="text-button" to="/setup">Open Sepolia setup ↗</Link></div>;
  if (!address) return <div className="feedback neutral"><WalletSmall/>Create a GhostPay wallet or connect MetaMask to continue. Test ETH only.</div>;
  if (chainId !== chain.id) return <div className="feedback error">Connect to Ethereum Sepolia (11155111). <button className="text-button" onClick={() => switchChain({ chainId: chain.id })}>Switch network</button>{error && <span>{error.message.slice(0, 140)}</span>}</div>;
  return null;
}
function WalletSmall() { return <ShieldCheck size={17}/>; }
export function CopyLink({ id, full = false }: {id: string|bigint; full?: boolean}) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState('');
  async function copy() { try { await navigator.clipboard.writeText(linkFor(id)); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { setError('Copy the payment URL from your address bar.'); } }
  return <><button className={full ? 'button secondary' : 'text-button'} onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied!' : 'Copy link'}</button>{error && <small role="alert">{error}</small>}</>;
}
export function ShareLink({ id }: {id: string|bigint}) { const [error, setError] = useState(''); return <><button className="button secondary" onClick={async () => { try { if (navigator.share) await navigator.share({ title: 'Your GhostPay payment', text: 'Open this link and request sender approval.', url: linkFor(id) }); else { await navigator.clipboard.writeText(linkFor(id)); setError('Link copied. Share it with your intended recipient.'); } } catch (e) { if ((e as Error).name !== 'AbortError') setError('Share unavailable. Use Copy link.'); } }}><Share2 size={16}/>Share</button>{error && <small role="status">{error}</small>}</>; }
export function TxHash({ hash }: {hash: string}) { return <div className="tx-receipt"><Check size={17}/><div><strong>Transaction confirmed</strong><a href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer"><code title={hash}>{hash}</code><small>View on Sepolia Etherscan ↗</small></a></div><ExternalLink size={15}/></div>; }
export function Status({ status, expiry, now }: {status: number; expiry: bigint; now: bigint}) { const label = status === 2 ? 'Claimed' : status === 3 ? 'Refunded' : status === 0 ? 'Not found' : expiry <= now ? 'Expired' : 'Active'; return <span className={`status ${label.toLowerCase()}`}><span/>{label}</span>; }
