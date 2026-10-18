import { useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { evmTestnets, type NativeNetwork } from '../../../shared/evm-networks';
import { Modal } from '../messenger/Modal';
export function NetworkPicker({ network, onChange, disabled }: { network: NativeNetwork; onChange(network: NativeNetwork): void; disabled: boolean }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [all, setAll] = useState(false);
  const matches = evmTestnets.filter(item => query ? `${item.name} ${item.symbol} ${item.id}`.toLowerCase().includes(query.toLowerCase()) : all || item.recommended);
  return <>
    <label>Native coin & testnet</label><button type="button" className="gp-network-picker" onClick={() => setOpen(true)} disabled={disabled}><span className="gp-coin-mark">{network.symbol.replace(/^t/, '').slice(0, 1)}</span><span><strong>{network.symbol}</strong><small>{network.name}</small></span><span className="gp-testnet-tag">TESTNET</span><ChevronDown size={16}/></button>
    {open && <Modal title="Choose your network." eyebrow="EVM NATIVE COINS · TESTNETS ONLY" onClose={() => setOpen(false)}>
      <p className="ms-modal-copy">Each network has its own test coins and escrow deployment. Funds stay on the selected chain.</p>
      <div className="gp-network-search"><Search size={16}/><input autoFocus aria-label="Search EVM testnets" placeholder="Search coin, testnet, or chain ID" value={query} onChange={e => setQuery(e.target.value)}/></div>
      <div className="gp-network-list">{matches.slice(0, 60).map(item => <button type="button" key={item.id} onClick={() => { onChange(item); setOpen(false); }}><span className="gp-coin-mark">{item.symbol.replace(/^t/, '').slice(0, 1)}</span><span><strong>{item.name}</strong><small>{item.symbol} · Chain {item.id}</small></span>{item.id === network.id && <Check size={16}/>}</button>)}{!matches.length && <p className="ms-fine">No matching EVM testnet.</p>}</div>
      {!query && !all && <button type="button" className="ms-text gp-browse-networks" onClick={() => setAll(true)}>Browse {evmTestnets.length} EVM testnet definitions<ChevronDown size={13}/></button>}
      <p className="ms-fine">Public RPC availability varies. The app verifies the chain and escrow code before transactions. Unsupported price feeds use native-coin entry.</p>
    </Modal>}
  </>;
}
