import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronRight, Copy, FlaskConical, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { decodeEventLog, getAddress, isAddress, keccak256, parseAbiItem, stringToHex, type Hex } from 'viem';
import { DEMO_RATE_MICROS, P2P_CHAIN_ID, decimal, parseP2PAmount, p2pPath, p2pQuote, p2pReference, settlementDomain, settlementTypes, type P2PReference } from '../../../shared/p2p';
import { useNativeWallet } from '../payments/useNativeWallet';
import { nativeClient } from '../payments/native';
import { useAction } from '../hooks/useAction';
import { readTrade, rememberSandbox, sandboxArtifact, savedSandbox, verifySandbox, type Sandbox, type Trade } from './client';
import './trade.css';

const phases = [
  { title: 'Agree on the exchange.', text: 'Both people see the same INR total, token amount and 0.5% fee before accepting.', icon: ArrowDownUp },
  { title: 'Tokens go into escrow.', text: 'The seller funds the trade. The buyer’s wallet and the exchange terms are fixed on-chain.', icon: LockKeyhole },
  { title: 'Payment needs evidence.', text: 'A payment report never unlocks escrow. A trusted verifier must attest to the exact trade.', icon: ShieldCheck },
  { title: 'Settle to the right wallet.', text: 'The buyer receives the net tokens. The protocol fee is paid separately, exactly once.', icon: CheckCheck },
];
const stateNames = ['Not found', 'Waiting for buyer', 'Terms accepted', 'Payment reported', 'Disputed', 'Settled', 'Refunded'];
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const randomHash = () => keccak256(stringToHex(crypto.randomUUID()));
interface OracleStatus { configured: boolean; reason?: string; rateMicros?: string; fetchedAt?: number; expiresAt?: number }

export default function TradePage() {
  const [params, setParams] = useSearchParams();
  const [amount, setAmount] = useState('100'); const [phase, setPhase] = useState(0);
  const [oracle, setOracle] = useState<OracleStatus>(); const [refresh, setRefresh] = useState(0);
  const [showChain, setShowChain] = useState(!!params.get('sandbox'));
  const [ref, setRef] = useState<P2PReference | null>(() => p2pReference(params) || savedSandbox());
  const [factoryInput, setFactoryInput] = useState(''); const [creationInput, setCreationInput] = useState('');
  const [sandbox, setSandbox] = useState<Sandbox>(); const [trade, setTrade] = useState<Trade>();
  const [buyer, setBuyer] = useState(''); const [proof, setProof] = useState('');
  const [acknowledged, setAcknowledged] = useState(false); const [tx, setTx] = useState<Hex>();
  const [pendingOffer, setPendingOffer] = useState<Hex>();
  const action = useAction(); const guard = useRef(false); const wallet = useNativeWallet(P2P_CHAIN_ID);
  const tradeId = params.get('trade') || ref?.tradeId;
  const rawReference = params.has('sandbox') || params.has('creation') || params.has('trade');
  const malformedLink = rawReference && !p2pReference(params);
  let quote: ReturnType<typeof p2pQuote> | undefined; let amountError = '';
  try { quote = p2pQuote(parseP2PAmount(amount), DEMO_RATE_MICROS); } catch (e) { amountError = (e as Error).message; }
  useEffect(() => {
    const controller = new AbortController(); setOracle(undefined);
    fetch('/api/p2p/quote', { cache: 'no-store', signal: controller.signal }).then(async r => {
      const body = await r.json() as OracleStatus;
      if (body.configured && (!/^\d{1,12}$/.test(body.rateMicros || '') || !body.expiresAt || body.expiresAt <= Date.now() / 1000)) throw new Error('Expired oracle quote.');
      if (!controller.signal.aborted) setOracle(body);
    }).catch(() => { if (!controller.signal.aborted) setOracle({ configured: false, reason: 'Live oracle is unavailable. Sandbox amounts use an illustrative rate.' }); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!oracle?.configured || !oracle.expiresAt) return;
    const timer = window.setTimeout(() => setOracle({ configured: false, reason: 'The market reference expired. Refresh to verify a new oracle round.' }), Math.max(0, oracle.expiresAt * 1000 - Date.now()));
    return () => window.clearTimeout(timer);
  }, [oracle]);
  // These are URL-derived PUBLIC contract identifiers, never bank details or proofs.
  useEffect(() => {
    const parsed = p2pReference(params);
    let active = true;
    setSandbox(undefined); setTrade(undefined); setProof('');
    if (parsed) {
      setRef(parsed); setShowChain(true);
      verifySandbox(parsed).then(async s => {
        const t = parsed.tradeId ? await readTrade(s, parsed.tradeId) : undefined;
        if (active) { setSandbox(s); if (t?.state) setTrade(t); else if (parsed.tradeId) action.setError('This trade does not exist in the verified sandbox.'); }
      }).catch(e => { if (active) action.setError(e.message || 'Sandbox verification failed.'); });
    }
    return () => { active = false; };
  }, [params]);
  async function run(fn: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true; await action.run(fn); guard.current = false;
  }
  async function trusted() {
    if (!ref || malformedLink) throw new Error('Deploy or import a verified Sepolia sandbox first.');
    const s = await verifySandbox(ref); setSandbox(s); return s;
  }
  async function refreshTrade() {
    const s = await trusted();
    if (tradeId) { const t = await readTrade(s, tradeId); if (!t.state) throw new Error('This trade does not exist in the verified sandbox.'); setTrade(t); }
    action.setNotice('Sepolia deployment and current trade state verified.');
  }
  async function transaction(fn: (w: Awaited<ReturnType<typeof wallet.wallet>>, s: Sandbox) => Promise<Hex>) {
    if (!acknowledged) throw new Error('Confirm that this is a test with no real INR or USDC.');
    const w = await wallet.wallet(); const s = await trusted(); const hash = await fn(w, s); setTx(hash);
    const receipt = await nativeClient(P2P_CHAIN_ID).waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status !== 'success') throw new Error('The Sepolia transaction reverted.');
    if ((await nativeClient(P2P_CHAIN_ID).getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The confirmation block changed. Recheck the submitted transaction.');
    if (tradeId) setTrade(await readTrade(s, tradeId));
    return { s, receipt };
  }
  async function deploy() {
    if (!acknowledged) throw new Error('Confirm test-only use before deployment.');
    const w = await wallet.wallet(); const a = await sandboxArtifact();
    const hash = await w.deployContract({ abi: a.GhostPayP2PSandbox.abi, bytecode: a.GhostPayP2PSandbox.bytecode }); setTx(hash);
    const receipt = await nativeClient(P2P_CHAIN_ID).waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Sandbox deployment failed.');
    const r = { factory: receipt.contractAddress, creation: hash }; const s = await verifySandbox(r);
    rememberSandbox(r); setRef(r); setSandbox(s); setTrade(undefined); setProof(''); setParams(new URLSearchParams(p2pPath(r).split('?')[1]));
    action.setNotice('Sandbox deployed. Your wallet is the simulated payment attestor and fee recipient. Save the deployment link.');
  }
  async function importSandbox() {
    const r = p2pReference(new URLSearchParams({ sandbox: factoryInput.trim(), creation: creationInput.trim() }));
    if (!r) throw new Error('Enter a valid factory address and creation transaction hash.');
    const s = await verifySandbox(r); rememberSandbox(r); setRef(r); setSandbox(s); setTrade(undefined); setProof(''); setParams(new URLSearchParams(p2pPath(r).split('?')[1]));
    action.setNotice('Exact factory deployment verified.');
  }
  async function offer() {
    if (!pendingOffer && (!quote || !isAddress(buyer) || buyer.toLowerCase() === wallet.address?.toLowerCase())) throw new Error('Enter a different buyer wallet and a valid amount.');
    const result = pendingOffer ? await (async () => {
      const s = await trusted(); const client = nativeClient(P2P_CHAIN_ID);
      const receipt = await client.waitForTransactionReceipt({ hash: pendingOffer, confirmations: 2 });
      if (receipt.status !== 'success') { setPendingOffer(undefined); throw new Error('The submitted deposit reverted. No trade was funded.'); }
      if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The confirmation block changed. Recheck this deposit.');
      return { s, receipt };
    })() : await transaction(async (w, s) => {
      if (buyer.toLowerCase() === w.account.address.toLowerCase()) throw new Error('The seller and buyer must use different wallets.');
      const client = nativeClient(P2P_CHAIN_ID); const abi = s.artifacts.GhostPayMockUSDC.abi;
      const balance = await client.readContract({ address: s.token, abi, functionName: 'balanceOf', args: [w.account.address] }) as bigint;
      if (balance < quote!.gross) throw new Error('Mint enough sandbox tokens before funding this trade.');
      const allowance = await client.readContract({ address: s.token, abi, functionName: 'allowance', args: [w.account.address, s.escrow] }) as bigint;
      if (allowance < quote!.gross) {
        const approval = await w.writeContract({ address: s.token, abi, functionName: 'approve', args: [s.escrow, quote!.gross] }); setTx(approval);
        const r = await client.waitForTransactionReceipt({ hash: approval, confirmations: 2 }); if (r.status !== 'success') throw new Error('Token approval failed.');
      }
      const now = (await client.getBlock()).timestamp;
      // Random demo-only payee commitment. No real UPI identifiers are collected.
      const hash = await w.writeContract({ address: s.escrow, abi: s.artifacts.GhostPayP2PSandboxEscrow.abi, functionName: 'createOffer', args: [getAddress(buyer), quote!.gross, quote!.rateMicros, now + 300n, randomHash()] });
      setPendingOffer(hash); return hash;
    });
    const { s, receipt } = result;
    let id: string | undefined;
    for (const log of receipt.logs) if (log.address.toLowerCase() === s.escrow.toLowerCase()) {
      try { const event = decodeEventLog({ abi: [parseAbiItem('event Offered(uint256 indexed tradeId, address indexed seller, address indexed buyer, bytes32 termsHash)')], data: log.data, topics: log.topics }); id = event.args.tradeId.toString(); } catch { /* Ignore unrelated token logs. */ }
    }
    if (!id) throw new Error('Deposit confirmed, but its trade event could not be decoded. Check the transaction before trying again.');
    setPendingOffer(undefined);
    const r = { ...s.ref, tradeId: id }; setRef(r); setParams(new URLSearchParams(p2pPath(r).split('?')[1])); setTrade(await readTrade(s, id));
    action.setNotice('Test tokens locked. Share this trade link with the specified buyer.');
  }
  async function tradeAction(functionName: string, args: unknown[]) {
    await transaction((w, s) => w.writeContract({ address: s.escrow, abi: s.artifacts.GhostPayP2PSandboxEscrow.abi, functionName, args }));
    action.setNotice('Transaction confirmed on Sepolia.');
  }
  async function attest() {
    const s = await trusted(); if (!tradeId) throw new Error('Open a funded trade first.');
    const w = await wallet.wallet(); if (w.account.address.toLowerCase() !== s.attestor.toLowerCase()) throw new Error('Only this sandbox’s deployer can sign simulated payment evidence.');
    const t = await readTrade(s, tradeId); if (![3, 4].includes(t.state) || /^0x0{64}$/.test(t.evidenceCommitment)) throw new Error('The buyer must report a simulated payment first.');
    const now = (await nativeClient(P2P_CHAIN_ID).getBlock()).timestamp;
    const paidAt = now < t.payUntil ? now : t.payUntil; const validUntil = t.payUntil + 2n * 86400n;
    const nullifier = t.evidenceCommitment; // Canonical within this sandbox, NOT an arbitrary per-proof nonce.
    const signature = await w.signTypedData({ domain: settlementDomain(s.escrow), types: settlementTypes, primaryType: 'Settlement', message: { tradeId: BigInt(tradeId), termsHash: t.termsHash, evidenceCommitment: t.evidenceCommitment, nullifier, paidAt, validUntil } });
    setProof(JSON.stringify({ tradeId, nullifier, paidAt: paidAt.toString(), validUntil: validUntil.toString(), signature }));
    action.setNotice('Simulated evidence signed. This is not verification of a bank payment. Copy the proof to the buyer, or submit it here.');
  }
  async function settle() {
    const p = JSON.parse(proof); if (p.tradeId !== tradeId || !/^0x[0-9a-f]{64}$/i.test(p.nullifier) || !/^\d{1,20}$/.test(p.paidAt) || !/^\d{1,20}$/.test(p.validUntil) || !/^0x[0-9a-f]{2,8192}$/i.test(p.signature)) throw new Error('Invalid sandbox evidence.');
    await tradeAction('settle', [BigInt(tradeId!), p.nullifier, BigInt(p.paidAt), BigInt(p.validUntil), p.signature]); setProof('');
  }
  const isBuyer = !!trade && trade.buyer.toLowerCase() === wallet.address?.toLowerCase();
  const isSeller = !!trade && trade.seller.toLowerCase() === wallet.address?.toLowerCase();
  const terminal = trade && [5, 6].includes(trade.state);
  const publicLink = ref ? `${location.origin}${p2pPath({ ...ref, ...(tradeId ? { tradeId } : {}) })}` : '';
  const ActiveIcon = phases[phase].icon;

  return <section className="gp-trade page">
    <div className="gp-trade-breadcrumb"><Link to="/payments">Payments</Link><ChevronRight size={13}/><span>P2P exchange</span></div>
    <header className="gp-trade-heading"><div><p className="ms-kicker">PERSON TO PERSON. ON YOUR TERMS.</p><h1>A fair exchange.<br/><em>A little more trust.</em></h1><p>INR on one side. USDC on the other.<br/>One shared agreement, before anything moves.</p></div><span className="gp-trade-tag"><FlaskConical size={15}/>Sepolia settlement lab</span></header>
    <div className="gp-trade-grid">
      <div className="gp-trade-quote panel">
        <div className="gp-trade-card-top"><span><ArrowDownUp size={16}/>USDC ↔ INR</span><span className="gp-testnet-tag">SANDBOX</span></div>
        <label htmlFor="p2p-amount">Seller locks <span>gpUSD · test token</span></label>
        <div className="gp-trade-amount"><input id="p2p-amount" value={amount} maxLength={16} disabled={action.busy || !!pendingOffer} onChange={e => { setAmount(e.target.value); setPhase(0); }} inputMode="decimal" autoComplete="off" aria-invalid={!!amountError} aria-describedby={amountError ? 'p2p-amount-error' : 'p2p-rate-note'}/><span>gpUSD</span></div>
        {amountError && <p id="p2p-amount-error" className="gp-trade-error" role="alert">{amountError}</p>}
        <div className="gp-trade-connector"><span/><ArrowDownUp size={15}/><span/></div>
        <div className="gp-trade-fiat"><span>Buyer’s simulated INR payment</span><strong>₹{quote ? decimal(quote.inrPaise, 2, false) : '—'}</strong><small>No real UPI payment. Nothing is debited.</small></div>
        <dl className="gp-trade-breakdown"><div><dt>Illustrative exchange rate</dt><dd>₹86.50 / token</dd></div><div><dt>Protocol fee · 0.5%</dt><dd>{quote ? decimal(quote.fee) : '—'} gpUSD</dd></div><div className="gp-trade-net"><dt>Buyer receives</dt><dd>{quote ? decimal(quote.net) : '—'} gpUSD</dd></div></dl>
        <button className="button primary" disabled={!quote} onClick={() => setPhase(p => (p + 1) % phases.length)}>{phase === 3 ? 'Replay the exchange' : phase === 0 ? 'Explore the exchange' : 'Next step'}<ArrowRight size={17}/></button>
        <p id="p2p-rate-note" className="gp-trade-caption"><FlaskConical size={13}/>Illustrative rate. gpUSD has no monetary value and is not Circle USDC.</p>
      </div>
      <aside className="gp-trade-story">
        <div className="gp-trade-orbit" aria-hidden="true"><span className="gp-trade-ring ring-one"/><span className="gp-trade-ring ring-two"/><span className="gp-trade-orbit-core"><ActiveIcon size={28}/></span><span className="gp-trade-satellite sat-one">₹</span><span className="gp-trade-satellite sat-two">$</span></div>
        <p className="ms-kicker">THE EXCHANGE, EXPLAINED</p><div className="gp-trade-story-copy" aria-live="polite"><h2>{phases[phase].title}</h2><p>{phases[phase].text}</p></div>
        <div className="gp-trade-steps" aria-label="Exchange stages">{phases.map((p, i) => <button key={p.title} aria-label={`Step ${i + 1}: ${p.title}`} aria-pressed={i === phase} onClick={() => setPhase(i)}><span>{i < phase ? <Check size={13}/> : `0${i + 1}`}</span><span className="gp-trade-step-line"/></button>)}</div>
        <div className="gp-trade-oracle"><div><ShieldCheck size={15}/><strong>Market reference</strong><button className="ms-icon" aria-label="Refresh market reference" onClick={() => setRefresh(x => x + 1)}><RefreshCw size={14}/></button></div>{oracle === undefined ? <p>Checking oracle configuration…</p> : oracle.configured ? <p>Chainlink reference: ₹{decimal(BigInt(oracle.rateMicros!), 6)} / USDC. Read on Polygon; settlement stays on Sepolia. <strong>Indicative only; not used for this demo’s fixed terms.</strong></p> : <p>{oracle.reason || 'Live oracle needs configuration.'} The example above uses a fixed ₹86.50 rate.</p>}<small>A market rate cannot prove that a UPI payment happened.</small></div>
      </aside>
    </div>
    <div className="gp-trade-lab-intro"><div><p className="ms-kicker">FROM EXPLANATION TO EXECUTION</p><h2>Try the escrow.<em> Keep it testnet.</em></h2><p>Run a real Sepolia token deposit and settlement with two wallets. INR evidence is simulated by the sandbox deployer.</p></div><button className="button secondary" aria-expanded={showChain} aria-controls="p2p-chain" onClick={() => setShowChain(v => !v)}><Wallet size={17}/>{showChain ? 'Close settlement lab' : 'Open settlement lab'}<ArrowUpRight size={16}/></button></div>
    {showChain && <div id="p2p-chain" className="gp-trade-lab panel">
      <div className="gp-trade-lab-title"><span className="gp-trade-tag"><FlaskConical size={14}/>Test tokens. Simulated evidence.</span><h2>Your settlement workspace.</h2><p>Connect a Sepolia wallet with test ETH for gas. The deployer signs demo evidence; this is a trusted-attestor prototype, not a live banking integration.</p></div>
      <label className="gp-trade-check"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/><span>I understand: no real INR, no real USDC. gpUSD is freely minted and worthless.</span></label>
      {malformedLink ? <p className="gp-trade-error" role="alert">This sandbox link is malformed. Open /trade to start a new deployment.</p> : <>
      <div className="gp-trade-setup"><div><h3>01 / Deploy or verify</h3><p>One deployment creates the test token and escrow. No existing payment contracts are changed.</p><div className="gp-trade-actions"><button className="button secondary" disabled={action.busy || !acknowledged} onClick={() => run(deploy)}>Deploy sandbox</button>{ref && <button className="button secondary" disabled={action.busy} onClick={() => run(refreshTrade)}>Verify & refresh</button>}</div></div>
      <details><summary>Import an existing sandbox</summary><label>Factory address<input value={factoryInput} onChange={e => setFactoryInput(e.target.value)} placeholder="0x…" autoComplete="off"/></label><label>Creation transaction<input value={creationInput} onChange={e => setCreationInput(e.target.value)} placeholder="0x…" autoComplete="off"/></label><button className="button secondary" disabled={action.busy} onClick={() => run(importSandbox)}>Verify deployment</button></details></div>
      {ref && <div className="gp-trade-deployment"><span>{sandbox ? <><ShieldCheck size={14}/>Verified Sepolia sandbox</> : <>Deployment needs verification</>}</span><a href={`https://sepolia.etherscan.io/address/${ref.factory}`} target="_blank" rel="noreferrer">{short(ref.factory)}<ArrowUpRight size={13}/></a><button className="button secondary" disabled={action.busy} onClick={() => run(async () => { await navigator.clipboard.writeText(publicLink); action.setNotice('Public sandbox link copied.'); })}><Copy size={14}/>Copy {tradeId ? 'trade' : 'setup'} link</button></div>}
      {sandbox && <><div className="gp-trade-chain-info"><span>Demo token <a href={`https://sepolia.etherscan.io/address/${sandbox.token}`} target="_blank" rel="noreferrer">{short(sandbox.token)}</a></span><span>Escrow <a href={`https://sepolia.etherscan.io/address/${sandbox.escrow}`} target="_blank" rel="noreferrer">{short(sandbox.escrow)}</a></span><span>Simulated attestor / fee recipient <code>{short(sandbox.attestor)}</code></span></div>
      {!tradeId && <div className="gp-trade-offer"><h3>02 / Fund a test trade</h3><p>Use the amount above. You are the seller. The buyer must be a different wallet.</p><label>Buyer’s Sepolia wallet<input value={buyer} maxLength={42} disabled={action.busy || !!pendingOffer} onChange={e => setBuyer(e.target.value)} placeholder="0x…" autoComplete="off"/></label><div className="gp-trade-actions"><button className="button secondary" disabled={action.busy || !acknowledged} onClick={() => run(async () => { await transaction((w,s) => w.writeContract({ address: s.token, abi: s.artifacts.GhostPayMockUSDC.abi, functionName: 'faucet' })); action.setNotice('100 worthless gpUSD minted to your wallet.'); })}>Mint 100 test tokens</button><button className="button primary" disabled={action.busy || !acknowledged || (!pendingOffer && (!quote || !isAddress(buyer)))} onClick={() => run(offer)}>{pendingOffer ? "Check submitted deposit" : "Approve & fund trade"}<LockKeyhole size={16}/></button></div><small>Exact-amount token approval, then deposit. Offer expires after five minutes; accepted trades get a 15-minute simulated payment window.</small></div>}
      </>}
      {trade && tradeId && sandbox && <div className="gp-trade-live"><div className="gp-trade-live-heading"><h3>Trade #{tradeId}</h3><span className="gp-trade-tag">{stateNames[trade.state]}</span></div><dl className="gp-trade-breakdown"><div><dt>Seller</dt><dd><code>{trade.seller}</code></dd></div><div><dt>Buyer</dt><dd><code>{trade.buyer}</code></dd></div><div><dt>Locked</dt><dd>{decimal(trade.gross)} gpUSD</dd></div><div><dt>Simulated INR total</dt><dd>₹{decimal(trade.inrPaise,2,false)}</dd></div><div><dt>Fee / buyer receives</dt><dd>{decimal(trade.fee)} / {decimal(trade.gross-trade.fee)} gpUSD</dd></div><div><dt>{trade.acceptedAt ? 'Payment deadline' : 'Accept before'}</dt><dd>{new Date(Number(trade.acceptedAt ? trade.payUntil : trade.acceptUntil)*1000).toLocaleString()}</dd></div></dl>
        {!wallet.external && <button className="button secondary" disabled={action.busy} onClick={() => run(async () => { await wallet.wallet(); })}>Connect a trading wallet</button>}
        <div className="gp-trade-actions">
          {trade.state === 1 && isBuyer && <button className="button primary" disabled={action.busy || !acknowledged} onClick={() => run(() => tradeAction('accept',[BigInt(tradeId),trade.termsHash]))}>Accept these exact terms</button>}
          {trade.state === 2 && isBuyer && <button className="button primary" disabled={action.busy || !acknowledged} onClick={() => run(() => tradeAction('reportPayment',[BigInt(tradeId),randomHash()]))}>Report simulated INR payment</button>}
          {[2,3].includes(trade.state) && (isBuyer || isSeller) && <button className="button secondary" disabled={action.busy || !acknowledged} onClick={() => run(() => tradeAction('dispute',[BigInt(tradeId)]))}>Flag a dispute</button>}
          {trade.state === 1 && isSeller && <button className="button secondary" disabled={action.busy || !acknowledged} onClick={() => run(() => tradeAction('refund',[BigInt(tradeId)]))}>Cancel unaccepted offer</button>}
        </div>
        {!terminal && [2,3,4].includes(trade.state) && <p className="gp-trade-caption">The seller cannot pull accepted escrow back. A dispute does not verify payment. Settlement still needs a valid attestation.</p>}
        {!terminal && [3,4].includes(trade.state) && <div className="gp-trade-proof"><h3>03 / Simulate evidence, then settle</h3><p>Only the deployer ({short(sandbox.attestor)}) can attest. The signature binds the trade, accepted terms, evidence, timestamps, chain and escrow. A UTR or typed reference cannot release funds.</p><button className="button secondary" disabled={action.busy || !acknowledged || wallet.address?.toLowerCase() !== sandbox.attestor.toLowerCase()} onClick={() => run(attest)}>Sign simulated payment evidence</button><label>Signed sandbox evidence<textarea value={proof} maxLength={16000} disabled={action.busy} onChange={e => setProof(e.target.value)} placeholder="Paste the signed sandbox evidence from the deployer" rows={4} autoComplete="off" spellCheck={false}/></label><div className="gp-trade-actions"><button className="button secondary" disabled={!proof || action.busy} onClick={() => run(async () => { await navigator.clipboard.writeText(proof); action.setNotice('Simulated proof copied.'); })}>Copy evidence</button><button className="button primary" disabled={!proof || action.busy || !acknowledged} onClick={() => run(settle)}>Verify & settle test tokens<ShieldCheck size={15}/></button></div></div>}
        {!terminal && trade.state > 1 && isBuyer && <details className="gp-trade-forfeit"><summary>Buyer recovery: return allocation to seller</summary><p>This forfeits your token claim and refunds the seller. Use only if you intentionally want to return the funds, including after a simulated payment report.</p><button className="button secondary" disabled={action.busy || !acknowledged} onClick={() => run(() => tradeAction('refund',[BigInt(tradeId)]))}>Forfeit my allocation & refund seller</button></details>}
        {terminal && <p className="gp-trade-success"><CheckCheck size={18}/>{trade.state === 5 ? 'Test tokens settled to the agreed buyer and fee recipient.' : 'Test tokens returned to the seller.'}</p>}
      </div>}
      </>}
      {action.busy && <p role="status" className="gp-trade-caption">Waiting for your wallet or Sepolia confirmations…</p>}
      {action.error && <p role="alert" className="gp-trade-error">{action.error}</p>}
      {action.notice && <p role="status" className="gp-trade-success">{action.notice}</p>}
      {tx && <a className="gp-trade-tx" href={`https://sepolia.etherscan.io/tx/${tx}`} target="_blank" rel="noreferrer">View latest Sepolia transaction<ArrowUpRight size={14}/></a>}
    </div>}
    <div className="gp-trade-boundary"><ShieldCheck size={20}/><div><h3>Built to keep the boundary clear.</h3><p>Live INR settlement is disabled until an authenticated payment-proof provider is integrated and reviewed. No bank details, UPI credentials or UTRs are collected here. The sandbox cannot accept real USDC. Evidence replay protection is local to each escrow; it is not a cross-chain payment-verification system.</p></div><Link to="/chat">Back to conversations<ArrowUpRight size={15}/></Link></div>
  </section>;
}
