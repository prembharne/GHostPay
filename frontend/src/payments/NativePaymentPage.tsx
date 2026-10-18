import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, getAddress, type Hex } from 'viem';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Copy, ExternalLink, Link2, LoaderCircle, LockKeyhole, ShieldCheck, Wallet } from 'lucide-react';
import { nativeAbi, nativeClaimTypes, nativeDomain, nativePath, nativeReference, nativeRequestTypes, parseEnvelope, requireTestnet, type NativeEnvelope, type NativeReference } from '../../../shared/nativeProtocol';
import { useAction } from '../hooks/useAction';
import { nativeClient, verifyNativeEscrow } from './native';
import { useNativeWallet } from './useNativeWallet';
import './payments.css';

export function useNativePayment(reference: NativeReference) {
  return useQuery({ queryKey: ['native-payment', reference.chainId, reference.contract.toLowerCase(), reference.paymentId], queryFn: async () => {
    const address = await verifyNativeEscrow(reference.chainId, reference.contract); const client = nativeClient(reference.chainId);
    const [payment, block] = await Promise.all([client.readContract({ address, abi: nativeAbi, functionName: 'getPayment', args: [BigInt(reference.paymentId)] }), client.getBlock()]);
    return { payment, now: block.timestamp };
  }, retry: 0, refetchInterval: 15000, staleTime: 10000 });
}
export default function NativePaymentPage() {
  const params = useParams();
  const reference = nativeReference({ version: 2, chainId: Number(params.chainId), contract: params.contract, paymentId: params.paymentId });
  return !reference ? <div className="page empty"><ShieldCheck size={32}/><h1>This payment link is invalid.</h1><p>Only EVM testnets are enabled. Ask your sender to check the network and full link.</p><Link className="button secondary" to="/chat">Back to messenger</Link></div> : <NativePayment reference={reference}/>;
}
function NativePayment({ reference }: { reference: NativeReference }) {
  const network = requireTestnet(reference.chainId); const query = useNativePayment(reference); const external = useNativeWallet(network.id); const action = useAction();
  const [proofLink, setProofLink] = useState(() => window.location.hash ? window.location.href : '');
  const [proof, setProof] = useState<{ kind: 'request' | 'authorization'; value: NativeEnvelope }>(); const [proofError, setProofError] = useState('');
  const [verified, setVerified] = useState(false); const [share, setShare] = useState<{ kind: 'request' | 'authorization'; url: string }>();
  const [tx, setTx] = useState<Hex>(); const [pending, setPending] = useState<'claim' | 'refund'>(); const [copied, setCopied] = useState(false);
  const p = query.data?.payment; const now = query.data?.now || 0n;
  const mine = !!p && external.address?.toLowerCase() === p.sender.toLowerCase(); const active = p?.status === 1 && p.expiry > now && now > 0n;
  const client = nativeClient(network.id); const domain = nativeDomain(reference);
  useEffect(() => { const changed = () => { setProofLink(window.location.hash ? window.location.href : ''); setVerified(false); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  useEffect(() => {
    let current = true; setProof(undefined); setProofError(''); setVerified(false);
    if (!proofLink || !p || p.status === 0) return;
    void (async () => {
      const url = new URL(proofLink, window.location.origin); const hash = new URLSearchParams(url.hash.slice(1));
      const kind = hash.has('authorization') ? 'authorization' : 'request'; const encoded = hash.get(kind);
      if (!encoded) throw new Error('Paste the complete signed request or claim link, including its # fragment.');
      const value = parseEnvelope(encoded, kind, reference);
      const message = kind === 'request' ? { paymentId: BigInt(value.paymentId), recipient: value.recipient, requestedAt: BigInt(value.requestedAt!) } : { paymentId: BigInt(value.paymentId), recipient: value.recipient, deadline: BigInt(value.deadline!) };
      const signer = kind === 'request' ? value.recipient : p.sender;
      const valid = await client.verifyTypedData({ address: signer, domain, types: kind === 'request' ? nativeRequestTypes : nativeClaimTypes, primaryType: kind === 'request' ? 'ClaimRequest' : 'ClaimAuthorization', message, signature: value.signature });
      if (!valid) throw new Error('The wallet signature does not match this payment.');
      if (kind === 'request' && (BigInt(value.requestedAt!) > now + 60n || BigInt(value.requestedAt!) + 30n * 86400n < now)) throw new Error('This signed request has an invalid or stale timestamp.');
      if (kind === 'authorization' && BigInt(value.deadline!) > p.expiry) throw new Error('Authorization extends beyond the escrow expiry.');
      if (current) setProof({ kind, value });
    })().catch(error => { if (current) setProofError((error as Error).message); });
    return () => { current = false; };
  }, [proofLink, p?.sender, p?.expiry, p?.status, reference.chainId, reference.contract, reference.paymentId]);
  const makeLink = (kind: 'request' | 'authorization', value: NativeEnvelope) => `${window.location.origin}${nativePath(reference)}#${kind}=${encodeURIComponent(JSON.stringify(value))}`;
  async function request() { await action.run(async () => {
    await verifyNativeEscrow(network.id, reference.contract); const wallet = await external.wallet(); const block = await client.getBlock();
    const current = await client.readContract({ address: getAddress(reference.contract), abi: nativeAbi, functionName: 'getPayment', args: [BigInt(reference.paymentId)] });
    if (current.status !== 1 || current.expiry <= block.timestamp) throw new Error('This escrow is no longer active.');
    const requestedAt = block.timestamp;
    const signature = await wallet.signTypedData({ domain, types: nativeRequestTypes, primaryType: 'ClaimRequest', message: { paymentId: BigInt(reference.paymentId), recipient: wallet.account.address, requestedAt } });
    setShare({ kind: 'request', url: makeLink('request', { ...reference, recipient: wallet.account.address, requestedAt: String(requestedAt), signature }) }); setCopied(false);
    action.setNotice('Send this signed request link back to the sender. It proves wallet control; it does not authorize a withdrawal.');
  }); }
  async function approve() { await action.run(async () => {
    if (!verified || proof?.kind !== 'request') throw new Error('Verify this person and their full wallet address before approving.');
    await verifyNativeEscrow(network.id, reference.contract); const wallet = await external.wallet(); const block = await client.getBlock();
    const current = await client.readContract({ address: getAddress(reference.contract), abi: nativeAbi, functionName: 'getPayment', args: [BigInt(reference.paymentId)] });
    if (current.sender.toLowerCase() !== wallet.account.address.toLowerCase() || current.status !== 1 || current.expiry <= block.timestamp) throw new Error('Only the current sender can approve an active payment.');
    const deadline = current.expiry < block.timestamp + 900n ? current.expiry : block.timestamp + 900n;
    const signature = await wallet.signTypedData({ domain, types: nativeClaimTypes, primaryType: 'ClaimAuthorization', message: { paymentId: BigInt(reference.paymentId), recipient: proof.value.recipient, deadline } });
    setShare({ kind: 'authorization', url: makeLink('authorization', { ...reference, recipient: proof.value.recipient, deadline: String(deadline), signature }) }); setCopied(false);
    action.setNotice('Send the wallet-bound claim link to this recipient. It is valid for at most 15 minutes and cannot be revoked early.');
  }); }
  async function transact(kind: 'claim' | 'refund') { await action.run(async () => {
    let hash = tx;
    if (!pending) {
      await verifyNativeEscrow(network.id, reference.contract); const wallet = await external.wallet();
      const block = await client.getBlock(); const current = await client.readContract({ address: getAddress(reference.contract), abi: nativeAbi, functionName: 'getPayment', args: [BigInt(reference.paymentId)] });
      if (current.status !== 1) throw new Error('This payment is no longer active.');
      if (kind === 'refund') {
        if (wallet.account.address.toLowerCase() !== current.sender.toLowerCase() || current.expiry > block.timestamp) throw new Error('Only the original sender can refund after expiry.');
        hash = await wallet.writeContract({ address: getAddress(reference.contract), abi: nativeAbi, functionName: 'refundPayment', args: [BigInt(reference.paymentId)] });
      } else {
        if (proof?.kind !== 'authorization' || proof.value.recipient.toLowerCase() !== wallet.account.address.toLowerCase()) throw new Error('Connect the exact wallet in the sender’s authorization.');
        if (BigInt(proof.value.deadline!) < block.timestamp || current.expiry <= block.timestamp) throw new Error('The authorization or payment expired. Ask for a fresh approval if the payment is still active.');
        hash = await wallet.writeContract({ address: getAddress(reference.contract), abi: nativeAbi, functionName: 'claimPayment', args: [BigInt(reference.paymentId), wallet.account.address, BigInt(proof.value.deadline!), proof.value.signature] });
      }
      setTx(hash); setPending(kind);
    }
    if (!hash || pending && pending !== kind) throw new Error('Check the submitted transaction before another action.');
    action.setNotice('Waiting for two testnet confirmations…'); const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 });
    if (receipt.status !== 'success') { setPending(undefined); throw new Error('The transaction reverted. Escrow state was not changed by it.'); }
    setPending(undefined); await query.refetch(); action.setNotice(kind === 'refund' ? 'The unclaimed deposit was refunded.' : 'Payment claimed by the approved wallet.');
  }); }
  async function copy(url: string) { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { action.setNotice('Copy the complete URL shown in the field.'); } }
  return <div className="page gp-native-payment"><Link className="back-link" to="/payments"><ArrowLeft size={15}/>All native payments</Link>
    <div className="page-heading"><span className="section-kicker">{network.name.toUpperCase()} · CHAIN {network.id} · TESTNET</span><h1>A little something.<br/><em>For the right wallet.</em></h1><p>Payment #{reference.paymentId} · native {network.symbol} escrow</p></div>
    <div className="gp-native-payment-grid"><section className="panel gp-native-review"><div className="gp-native-network"><ShieldCheck size={17}/><strong>{network.name}</strong><span className="gp-testnet-tag">TESTNET</span></div>
      {query.isPending ? <p className="ms-modal-copy"><LoaderCircle className="spin" size={17}/>Verifying the network and escrow code…</p> : query.error ? <><p className="ms-alert" role="alert">{query.error.message}</p><button className="ms-button ms-secondary" onClick={() => { void query.refetch(); }}>Retry verification</button></> : !p || p.status === 0 ? <p className="ms-alert">No payment exists with this ID in the verified escrow.</p> : <>
        <div className="gp-native-amount">{formatUnits(p.amount, network.decimals)}<span>{network.symbol}</span></div>
        <div className="gp-native-status"><LockKeyhole size={14}/>{p.status === 2 ? 'Claimed' : p.status === 3 ? 'Refunded' : active ? 'Held in the verified escrow' : 'Expired · refundable by sender'}</div>
        <dl className="ms-details-list"><div><dt>Sender</dt><dd>{p.sender}</dd></div><div><dt>Escrow</dt><dd>{reference.contract}</dd></div><div><dt>Expires</dt><dd>{new Date(Number(p.expiry) * 1000).toLocaleString()}</dd></div></dl>
        <button className="ms-button ms-secondary ms-full" disabled={action.busy} onClick={() => { void action.run(async () => { await external.wallet(); }); }}><Wallet size={16}/>{external.external ? `${external.address!.slice(0, 6)}…${external.address!.slice(-4)} · ${external.chainId === network.id ? network.symbol : 'switch network'}` : 'Connect MetaMask'}</button>
        {active && !mine && proof?.kind !== 'authorization' && <button className="ms-button ms-primary ms-full" disabled={action.busy} onClick={request}>Sign a claim request<ArrowUpRight size={16}/></button>}
        {mine && active && proof?.kind === 'request' && <div className="gp-native-approval"><p className="ms-kicker">VERIFIED WALLET REQUEST</p><code>{proof.value.recipient}</code><label className="ms-check"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)}/>I independently verified this person and this exact wallet.</label><button className="ms-button ms-primary ms-full" disabled={action.busy || !verified} onClick={approve}>Approve this wallet<Check size={16}/></button></div>}
        {active && proof?.kind === 'authorization' && <div className="gp-native-approval"><p className="ms-kicker">SENDER SIGNATURE VERIFIED</p><code>{proof.value.recipient}</code><p className="ms-fine">Authorized until {new Date(Number(proof.value.deadline) * 1000).toLocaleString()}.</p><button className="ms-button ms-primary ms-full" disabled={action.busy || BigInt(proof.value.deadline!) < now || !!pending && pending !== 'claim'} onClick={() => transact('claim')}>{pending === 'claim' ? 'Check submitted claim' : 'Claim to the approved wallet'}<ArrowDownLeft size={17}/></button>{BigInt(proof.value.deadline!) < now && <p className="ms-alert">This approval expired. Ask the sender to renew it while the payment is active.</p>}</div>}
        {mine && p.status === 1 && p.expiry <= now && <button className="ms-button ms-primary ms-full" disabled={action.busy || !!pending && pending !== 'refund'} onClick={() => transact('refund')}>{pending === 'refund' ? 'Check submitted refund' : 'Refund unclaimed deposit'}<ArrowDownLeft size={16}/></button>}
        {active && mine && proof?.kind !== 'request' && <p className="ms-modal-copy">Share the payment link. Your recipient signs a wallet request and sends its link back to you. Paste it below to approve.</p>}
      </>}
      {action.busy && <p className="ms-fine" role="status"><LoaderCircle size={15} className="spin"/>Waiting for your wallet or the network…</p>}{action.error && <p className="ms-alert" role="alert">{action.error}</p>}{action.notice && <p className="ms-fine" role="status">{action.notice}</p>}
      {tx && network.explorer && <a className="ms-text" href={`${network.explorer}/tx/${tx}`} target="_blank" rel="noreferrer">View transaction<ExternalLink size={13}/></a>}
      <button className="ms-button ms-secondary ms-full" onClick={() => copy(`${window.location.origin}${nativePath(reference)}`)}><Link2 size={15}/>Copy payment link</button>
    </section><aside className="gp-native-side"><section className="panel"><p className="ms-kicker">A REQUEST. A SIGNATURE. YOUR CONTROL.</p><h2>Permission travels<br/><em>with the link.</em></h2><p>Signed request and claim links work across devices without a claim-relay account. Anyone can see the deposit; only the sender-approved wallet can claim it.</p><ol><li>Recipient signs a wallet request.</li><li>Sender verifies the person and wallet.</li><li>Sender shares a signed claim link.</li><li>The exact recipient claims on {network.name}.</li></ol><p className="ms-fine">Test {network.symbol} only. Recipients need network gas. Approvals cannot be revoked before their deadline; the first valid claim wins. These links do not bridge funds.</p></section>
      {p && p.status !== 0 && <section className="panel ms-form"><label htmlFor="native-proof">Signed request or claim link</label><textarea id="native-proof" rows={3} value={proofLink} onChange={e => { setProofLink(e.target.value); setVerified(false); }} placeholder="Paste the complete GhostPay link, including #request= or #authorization=" maxLength={6000}/>{proofError && <p className="ms-alert" role="alert">{proofError}</p>}{proof && <p className="gp-proof-valid"><ShieldCheck size={15}/>{proof.kind === 'request' ? 'Recipient wallet signature verified' : 'Sender authorization verified'}</p>}</section>}
      {share && <section className="panel gp-funded-link"><p className="ms-kicker">{share.kind === 'request' ? 'SEND THIS BACK TO THE SENDER' : 'SEND THIS TO THE APPROVED RECIPIENT'}</p><textarea readOnly rows={4} aria-label={share.kind === 'request' ? 'Signed claim request link' : 'Signed authorization link'} value={share.url}/><button className="ms-button ms-primary ms-full" onClick={() => copy(share.url)}><Copy size={15}/>{copied ? 'Copied' : share.kind === 'request' ? 'Copy signed request link' : 'Copy wallet-bound claim link'}</button></section>}
    </aside></div>
  </div>;
}
