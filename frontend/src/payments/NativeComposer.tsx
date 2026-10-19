import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { decodeEventLog, formatUnits, getAddress, isAddress, type Hex } from 'viem';
import { Check, Copy, ExternalLink, LoaderCircle, Rocket, Send, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { networkById } from '../../../shared/evm-networks';
import { amountInNative } from '../../../shared/amounts';
import type { MarketQuote } from '../../../shared/market';
import { nativeAbi, nativePath, type NativeReference } from '../../../shared/nativeProtocol';
import { chain, contractAddress, deployed, escrowAbi, explorer } from '../config/web3';
import { Wallet } from '../components/Wallet';
import { useAction } from '../hooks/useAction';
import { linkFor } from '../lib/api';
import { Modal } from '../messenger/Modal';
import type { PaymentReference } from '../messenger/model';
import { AmountField } from './AmountField';
import { NetworkPicker } from './NetworkPicker';
import { useMarket } from './useMarket';
import { nativeArtifact, nativeClient, rememberEscrow, rememberedEscrow, rememberedCreation, rememberNativePayment, verifyNativeEscrow } from './native';
import { useNativeWallet } from './useNativeWallet';
import './payments.css';

export function NativeComposer({ onClose, onShare, recipient, standalone = false, inline = false, onLock }: {
  onClose(): void; onShare?: (body: string, payment: PaymentReference) => Promise<void>; recipient?: string; standalone?: boolean; inline?: boolean; onLock?(locked: boolean): void;
}) {
  const [network, setNetwork] = useState(() => networkById(11155111)!);
  const [configured, setConfigured] = useState(() => rememberedEscrow(network.id)); const [importAddress, setImportAddress] = useState(''); const [importHash, setImportHash] = useState('');
  const [amount, setAmount] = useState(''); const [mode, setMode] = useState<'usd' | 'native'>('usd'); const [expiry, setExpiry] = useState('86400');
  const [snapshot, setSnapshot] = useState<{ units: bigint; native: string; quote?: MarketQuote }>();
  const [funded, setFunded] = useState<{ reference: Extract<PaymentReference, { version: 1 | 2 }>; hash: Hex; url: string }>();
  const fundedRef = useRef<typeof funded>(undefined); const [pendingHash, setPendingHash] = useState<Hex>(); const pending = useRef<Hex>(undefined);
  const [deployHash, setDeployHash] = useState<Hex>(); const deploying = useRef<Hex>(undefined); const [copied, setCopied] = useState(false);
  const account = useAccount(); const external = useNativeWallet(network.id); const market = useMarket(network.symbol);
  const legacyClient = usePublicClient({ chainId: chain.id }); const { writeContractAsync } = useWriteContract(); const action = useAction();
  const legacy = network.id === chain.id && !configured; const ready = legacy ? deployed : !!configured && !!rememberedCreation(network.id, configured);
  const locked = action.busy || !!pendingHash || !!funded || !!deployHash;
  useEffect(() => { onLock?.(locked); }, [locked]);
  async function connect() { await action.run(async () => { await external.wallet(); }); }
  async function deployContract() { await action.run(async () => {
    const wallet = await external.wallet(); const client = nativeClient(network.id); const artifact = await nativeArtifact();
    const hash = deploying.current || await wallet.deployContract({ abi: nativeAbi, bytecode: artifact.bytecode });
    deploying.current = hash; setDeployHash(hash); action.setNotice(`Waiting for two confirmations on ${network.name}…`);
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status !== 'success' || !receipt.contractAddress) { deploying.current = undefined; setDeployHash(undefined); throw new Error('Deployment reverted. No escrow was configured.'); }
    const block = await client.getBlock({ blockNumber: receipt.blockNumber }); if (block.hash !== receipt.blockHash) throw new Error('Deployment block changed. Check the same transaction again.');
    const address = await verifyNativeEscrow(network.id, receipt.contractAddress, hash); rememberEscrow(network.id, address, hash); setConfigured(address);
    deploying.current = undefined; setDeployHash(undefined); action.setNotice('Escrow verified. You can create a payment now.');
  }); }
  async function importContract() { await action.run(async () => {
    if (!/^0x[\da-fA-F]{64}$/.test(importHash)) throw new Error('Enter the contract creation transaction hash.');
    if (!isAddress(importAddress)) throw new Error('Enter a complete EVM contract address.');
    const address = await verifyNativeEscrow(network.id, importAddress, importHash); rememberEscrow(network.id, address, importHash); setConfigured(address); setImportAddress(''); action.setNotice('The escrow bytecode and network match.');
  }); }
  async function share(payment: NonNullable<typeof funded>) {
    if (onShare) await onShare(`A little something, headed your way. ${payment.url}`, payment.reference);
    if (onShare) onClose();
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); await action.run(async () => {
      if (fundedRef.current) return share(fundedRef.current);
      const value = snapshot && pending.current ? snapshot : { ...amountInNative(amount, mode, network.decimals, market.quote), quote: market.quote };
      setSnapshot(value);
      let reference: Extract<PaymentReference, { version: 1 | 2 }>; let hash: Hex; let id: string | undefined;
      if (legacy) {
        if (!account.address || account.chainId !== chain.id || !legacyClient || !deployed) throw new Error('Connect a wallet to Ethereum Sepolia first.');
        const block = await legacyClient.getBlock();
        if (!pending.current && mode === 'usd') amountInNative(amount, mode, network.decimals, value.quote);
        hash = pending.current || await writeContractAsync({ address: contractAddress, abi: escrowAbi, functionName: 'createETHPayment', args: [block.timestamp + BigInt(expiry)], value: value.units, chainId: chain.id });
        pending.current = hash; setPendingHash(hash); action.setNotice('Waiting for the Sepolia deposit to confirm…');
        const receipt = await legacyClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') { pending.current = undefined; setPendingHash(undefined); throw new Error('Deposit reverted. No payment was created.'); }
        for (const log of receipt.logs) { if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue; try { const event = decodeEventLog({ abi: escrowAbi, eventName: 'PaymentCreated', data: log.data, topics: log.topics }); if (event.args.sender.toLowerCase() === account.address.toLowerCase() && event.args.amount === value.units) id = String(event.args.paymentId); } catch {} }
        reference = { version: 1, chainId: chain.id, contract: contractAddress, paymentId: id || '' };
      } else {
        const proof = rememberedCreation(network.id, configured); if (!proof) throw new Error('Verify the escrow creation transaction before funding it.');
        const address = await verifyNativeEscrow(network.id, configured, proof); const wallet = await external.wallet(); const client = nativeClient(network.id);
        if (!pending.current && mode === 'usd') amountInNative(amount, mode, network.decimals, value.quote);
        const block = await client.getBlock();
        hash = pending.current || await wallet.writeContract({ address, abi: nativeAbi, functionName: 'createNativePayment', args: [block.timestamp + BigInt(expiry)], value: value.units });
        pending.current = hash; setPendingHash(hash); action.setNotice(`Waiting for ${network.name} to confirm your deposit…`);
        const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 });
        if (receipt.status !== 'success') { pending.current = undefined; setPendingHash(undefined); throw new Error('Deposit reverted. No payment was created.'); }
        const canonical = await client.getBlock({ blockNumber: receipt.blockNumber }); if (canonical.hash !== receipt.blockHash) throw new Error('Deposit block changed. Check this same transaction again.');
        for (const log of receipt.logs) { if (log.address.toLowerCase() !== address.toLowerCase()) continue; try { const event = decodeEventLog({ abi: nativeAbi, eventName: 'PaymentCreated', data: log.data, topics: log.topics }); if (event.args.sender.toLowerCase() === wallet.account.address.toLowerCase() && event.args.amount === value.units) id = String(event.args.paymentId); } catch {} }
        reference = { version: 2, chainId: network.id, contract: address, paymentId: id || '', deploymentHash: proof };
        if (id) rememberNativePayment({ ...reference as NativeReference, hash, account: wallet.account.address, createdAt: Date.now() });
      }
      if (!id) throw new Error('No matching payment event found. Inspect this transaction before creating another deposit.');
      const url = reference.version === 1 ? linkFor(reference.paymentId) : `${window.location.origin}${nativePath(reference)}`;
      const payment = { reference, hash, url }; fundedRef.current = payment; setFunded(payment); await share(payment);
    });
    if (!pending.current && !fundedRef.current) setSnapshot(undefined);
  }
  const contents = <>
    <p className="ms-modal-copy">{recipient ? `Create a link for ${recipient}. ` : 'Fund a payment and share its link. '}Your recipient chooses a wallet. You approve the exact address.</p>
    <form className="ms-form gp-native-form" onSubmit={submit}>
      <NetworkPicker network={network} disabled={locked} onChange={next => { setNetwork(next); setConfigured(rememberedEscrow(next.id)); setAmount(''); setSnapshot(undefined); setMode(marketSymbolSupported(next.symbol) ? 'usd' : 'native'); setImportAddress(''); }}/>
      <div className="gp-network-context"><ShieldCheck size={13}/><span>Testnet only · no bridging · native {network.symbol}</span></div>
      {legacy ? <div className="ms-wallet-connect workspace"><Wallet/></div> : <div className="gp-network-wallet"><button type="button" className="ms-button ms-secondary ms-full" onClick={connect} disabled={action.busy || external.connecting}><WalletIcon size={16}/>{external.external ? external.chainId === network.id ? `${account.address!.slice(0, 6)}…${account.address!.slice(-4)} · ${network.symbol}` : `Switch wallet to ${network.name}` : 'Continue with Google or wallet'}<Check size={14}/></button><p className="ms-fine">The device wallet supports the original Sepolia escrow. Use Google or an external wallet for other EVM escrows.</p></div>}
      {!ready && <div className="gp-deploy-panel"><span className="ms-kicker">ONE SHARED CONTRACT · ONE DEPLOYMENT PER NETWORK</span><h3>Set up {network.name}.</h3><p>Deploy the same native-coin escrow using your wallet. This pays testnet network gas, with no payment deposit.</p><button type="button" className="ms-button ms-primary ms-full" disabled={action.busy} onClick={deployContract}><Rocket size={16}/>{deployHash ? 'Check this deployment' : `Deploy escrow on ${network.symbol} testnet`}</button><details><summary>Use an existing GhostPay native escrow</summary><label htmlFor="native-import">Contract address</label><input id="native-import" value={importAddress} onChange={e => setImportAddress(e.target.value.trim())} placeholder="0x…"/><label htmlFor="native-creation-hash">Creation transaction hash</label><input id="native-creation-hash" value={importHash} onChange={e => setImportHash(e.target.value.trim())} placeholder="0x…"/><button type="button" className="ms-button ms-secondary" disabled={action.busy} onClick={importContract}>Verify deployment & exact code</button></details></div>}
      <AmountField id="chat-amount" symbol={network.symbol} decimals={network.decimals} value={amount} onChange={setAmount} mode={mode} setMode={setMode} disabled={locked} fixedQuote={snapshot?.quote}/>
        <label htmlFor="chat-expiry">Link expires in</label><select id="chat-expiry" value={expiry} onChange={e => setExpiry(e.target.value)} disabled={locked}><option value="3600">1 hour</option><option value="86400">24 hours</option><option value="604800">7 days</option><option value="300">5 minutes · quick test</option></select>
        <div className="ms-summary-row"><span>Protocol fee</span><strong>0 {network.symbol}<small> + network gas</small></strong></div>
        <div className="ms-modal-note"><ShieldCheck size={17}/><span>Your deposit will be held in escrow on {network.name}. Sharing a link does not authorize withdrawal. {onShare && 'If messaging is not connected, the card stays on this device; share the public link separately.'}</span></div>
      {action.error && <p className="ms-alert" role="alert">{action.error}</p>}{action.notice && <p className="ms-fine" role="status">{action.notice}</p>}
      {(pendingHash || deployHash) && (legacy ? explorer : network.explorer) && <a className="ms-text" href={`${legacy ? explorer : network.explorer}/tx/${pendingHash || deployHash}`} target="_blank" rel="noreferrer">View submitted transaction<ExternalLink size={13}/></a>}
      {funded && <div className="gp-funded-link"><p><Check size={16}/>Payment #{funded.reference.paymentId} is funded.</p><code>{funded.url}</code><div className="ms-inline-actions"><button type="button" className="ms-button ms-secondary" onClick={async () => { try { await navigator.clipboard.writeText(funded.url); setCopied(true); } catch { action.setError('Copy the payment URL shown above.'); } }}><Copy size={14}/>{copied ? 'Copied' : 'Copy link'}</button><a className="ms-button ms-secondary" href={funded.url}>Open payment<ExternalLink size={14}/></a></div></div>}
      {ready && <button className="ms-button ms-primary" disabled={action.busy || !!funded && !onShare || !funded && !pendingHash && (legacy ? !account.address || account.chainId !== chain.id : !external.external) || mode === 'usd' && !market.quote && !pendingHash && !funded}>{action.busy ? <LoaderCircle size={17} className="spin"/> : <Send size={17}/>} {funded ? onShare ? 'Share this funded payment' : 'Payment link ready' : pendingHash ? 'Check deposit & share' : onShare ? 'Create & share payment' : 'Create payment link'}</button>}
    </form>
  </>;
  return inline ? contents : standalone ? <section className="gp-native-standalone ms-modal-body"><p className="ms-kicker">A PAYMENT, WITHOUT THE ADDRESS</p><h1>Send a little <em>something.</em></h1>{contents}</section> : <Modal title="Send a little something." eyebrow="A PAYMENT, INSIDE THE CONVERSATION" onClose={() => { if (!action.busy) onClose(); }}>{contents}</Modal>;
}
function marketSymbolSupported(symbol: string) { return ['ETH', 'tETH', 'tBNB', 'BNB', 'POL', 'AVAX', 'CELO', 'S-CELO', 'S', 'FTM', 'ETC', 'XDAI'].includes(symbol); }
