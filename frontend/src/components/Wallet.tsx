import { useAccount, useBalance, useDisconnect, useSwitchChain } from 'wagmi';
import { Wallet as WalletIcon, ChevronDown, LogOut } from 'lucide-react';
import { chain } from '../config/web3';
import { short } from '../lib/api';
import { useAction } from '../hooks/useAction';
import { lazy, Suspense, useState } from 'react';
const WalletDialog = lazy(() => import('../wallet/WalletDialog'));
export function Wallet() {
  const [open, setOpen] = useState(false);
  const { address, chainId } = useAccount(); const { disconnect } = useDisconnect(); const { switchChainAsync } = useSwitchChain();
  const { data: balance } = useBalance({ address, chainId: chain.id, query: { refetchInterval: 5000 } }); const action = useAction();
  return <div className="wallet-wrap">
    {address ? <><button className="wallet-button" onClick={() => { if (chainId !== chain.id) void action.run(async () => { await switchChainAsync({ chainId: chain.id }); }); else setOpen(true); }}><span className="wallet-dot"/>{chainId !== chain.id ? 'Switch to Sepolia' : <><span className="balance">{Number(balance?.formatted || 0).toFixed(3)} ETH</span><span className="wallet-address">{short(address)}</span></>}<ChevronDown size={14}/></button><button className="icon-button" aria-label="Disconnect wallet" onClick={() => disconnect()}><LogOut size={17}/></button></> : <button className="wallet-button" disabled={action.busy} onClick={() => setOpen(true)}><WalletIcon size={16}/>Your wallet<ChevronDown size={14}/></button>}
    {action.error && <div className="wallet-error" role="alert">{action.error} <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask ↗</a></div>}
    {open && <Suspense fallback={null}><WalletDialog onClose={() => setOpen(false)}/></Suspense>}
  </div>;
}
