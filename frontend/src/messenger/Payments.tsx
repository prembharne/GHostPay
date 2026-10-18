import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Check, ExternalLink, Ghost, Link2, LoaderCircle, LockKeyhole, Send, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { decodeEventLog, formatEther, parseEther } from 'viem';
import { useAccount, usePublicClient, useSignMessage, useSignTypedData, useWriteContract } from 'wagmi';
import { chain, contractAddress, deployed, escrowAbi, explorer, claimDomain, claimTypes, requestMessage, rejectMessage } from '../config/web3';
import { usePayment, useChainTime } from '../hooks/useEscrow';
import { useAction } from '../hooks/useAction';
import { Wallet } from '../components/Wallet';
import { api, date, linkFor, type ClaimRequest } from '../lib/api';
import { chainNow } from '../../../shared/clock';
import { Modal } from './Modal';
import { useMessenger } from './MessengerContext';
import type { PaymentReference } from './model';
import { NativeComposer } from '../payments/NativeComposer';
import { NativeCard } from '../payments/NativeCard';

export function PaymentCard(props: { payment?: PaymentReference; preview?: boolean; onOpen: (id: string) => void; onCreate: () => void }) {
  return props.payment?.version === 2 ? <NativeCard reference={props.payment}/> : <LegacyPaymentCard {...props}/>;
}

function LegacyPaymentCard({ payment, preview, onOpen, onCreate }: { payment?: PaymentReference; preview?: boolean; onOpen: (id: string) => void; onCreate: () => void }) {
  const valid = !!payment && payment.contract.toLowerCase() === contractAddress.toLowerCase() && payment.chainId === chain.id;
  const result = usePayment(valid ? BigInt(payment!.paymentId) : 0n); const p = result.data;
  const label = preview ? 'Design preview · no deposit' : !valid ? 'Different escrow · verify first' : result.isError ? 'Could not read payment' : !p ? 'Reading Sepolia…' : p.status === 2 ? 'Claimed' : p.status === 3 ? 'Refunded' : p.status === 0 ? 'Payment not found' : p.expiry <= BigInt(Math.floor(Date.now() / 1000)) ? 'Expired' : 'Held in escrow';
  return <div className={`ms-pay-card${preview ? ' is-preview' : ''}`}>
    <div className="ms-pay-card-top"><span className="ms-pay-symbol"><Ghost size={19}/></span><span>GhostPay payment</span><ArrowUpRight size={16}/></div>
    <div className="ms-pay-amount">{preview ? '0.015' : p ? Number(formatEther(p.amount)).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <span>ETH</span></div>
    <p>{preview ? 'A little something, headed your way.' : `Payment #${payment?.paymentId} · Ethereum Sepolia`}</p>
    <div className="ms-pay-state"><span/>{label}</div>
    <button onClick={() => preview ? onCreate() : valid && onOpen(payment!.paymentId)} disabled={!preview && (!valid || !p || p.status === 0)}>{preview ? 'Create a real payment' : 'View payment'}<ArrowUpRight size={15}/></button>
    <span className="ms-pay-card-note"><LockKeyhole size={11}/>{preview ? 'Preview card · test ETH only' : 'Sender approval required'}</span>
  </div>;
}

export function PaymentComposer({ onClose }: { onClose: () => void }) {
  const chat = useMessenger(); const room = chat.rooms.find(item => item.id === chat.activeId);
  return <NativeComposer onClose={onClose} recipient={room?.name} onShare={async (body, reference) => { await chat.send(body, reference); chat.notify(chat.mode === 'preview' ? 'Payment card saved on this device. Share its public link separately.' : 'Payment shared in this encrypted conversation.'); }}/>;
}

export function PaymentDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const chat = useMessenger(); const { address, chainId } = useAccount(); const client = usePublicClient({ chainId: chain.id });
  const payment = usePayment(BigInt(id)); const { data: now = 0n } = useChainTime(); const { signMessageAsync } = useSignMessage(); const { signTypedDataAsync } = useSignTypedData(); const { writeContractAsync } = useWriteContract();
  const requests = useQuery({ queryKey: ['requests', id], queryFn: () => api<ClaimRequest[]>(`/requests/payment/${id}`), refetchInterval: 4000 });
  const p = payment.data; const sender = p?.sender.toLowerCase() === address?.toLowerCase(); const mine = requests.data?.find(r => r.recipient.toLowerCase() === address?.toLowerCase());
  const active = !!p && p.status === 1 && p.expiry > now && now > 0n; const connected = !!address && chainId === chain.id; const action = useAction();
  const [verified, setVerified] = useState<Record<string, boolean>>({}); const [hash, setHash] = useState('');
  async function refresh() { await Promise.all([payment.refetch(), requests.refetch()]); }
  async function requestClaim() { await action.run(async () => { if (!address || !connected) throw new Error('Connect to Sepolia first.'); const timestamp = Math.floor(Date.now() / 1000); const signature = await signMessageAsync({ message: requestMessage(chain.id, contractAddress, id, address, timestamp) }); await api('/requests', { paymentId: id, chainId: chain.id, recipient: address, timestamp, signature }); await refresh(); }); }
  async function approve(r: ClaimRequest) { await action.run(async () => { if (!verified[r.id] || !connected || !p || !client) throw new Error('Verify this person and their exact wallet before signing.'); const time = chainNow(await client.getBlock()); const deadline = p.expiry < time + 900n ? p.expiry : time + 900n; if (deadline <= time) throw new Error('Payment expired.'); const signature = await signTypedDataAsync({ domain: claimDomain(chain.id, contractAddress), types: claimTypes, primaryType: 'ClaimAuthorization', message: { paymentId: BigInt(id), recipient: r.recipient, deadline } }); await api(`/requests/${r.id}/authorize`, { deadline: String(deadline), signature }); await refresh(); }); }
  async function reject(r: ClaimRequest) { await action.run(async () => { const signature = await signMessageAsync({ message: rejectMessage(r.id, chain.id, contractAddress) }); await api(`/requests/${r.id}/reject`, { signature }); await refresh(); }); }
  async function transact(refund = false) { await action.run(async () => { if (!client || !address || !connected) throw new Error('Connect to Sepolia first.');
    const tx = refund ? await writeContractAsync({ address: contractAddress, abi: escrowAbi, functionName: 'refundPayment', args: [BigInt(id)], chainId: chain.id }) : await writeContractAsync({ address: contractAddress, abi: escrowAbi, functionName: 'claimPayment', args: [BigInt(id), address, BigInt(mine!.deadline!), mine!.signature!], chainId: chain.id });
    action.setNotice('Waiting for Sepolia confirmation…'); const receipt = await client.waitForTransactionReceipt({ hash: tx }); if (receipt.status !== 'success') throw new Error('Transaction reverted.'); setHash(tx); await refresh(); action.setNotice(refund ? 'Your unclaimed deposit was refunded.' : 'Payment received by your wallet.');
  }); }
  return <Modal title={sender ? 'A payment, in your control.' : 'A little something for you.'} eyebrow={`PAYMENT #${id} · ETHEREUM SEPOLIA`} wide onClose={() => { if (!action.busy) onClose(); }}>
    <div className="ms-wallet-connect workspace"><Wallet/></div>
    {!p ? <p className="ms-modal-copy">{payment.error ? 'Could not read this payment. Check your Sepolia connection.' : 'Reading the escrow…'}</p> : <>
      <div className="ms-review-amount">{formatEther(p.amount)} <span>ETH</span></div><div className="ms-review-status"><LockKeyhole size={14}/>{p.status === 2 ? 'Claimed' : p.status === 3 ? 'Refunded' : active ? 'Held securely by the escrow contract' : 'Expired · refundable by sender'}</div>
      <dl className="ms-details-list"><div><dt>From</dt><dd>{p.sender}</dd></div><div><dt>Expires</dt><dd>{date(p.expiry)}</dd></div><div><dt>Authorization</dt><dd>Exact recipient wallet · sender signature</dd></div></dl>
      {sender && active && <div className="ms-claim-requests"><h3>Wallet requests</h3>{!requests.data?.length && <p className="ms-modal-copy">Share the link. Your recipient’s request will appear here.</p>}{requests.data?.map(r => <div className="ms-request" key={r.id}><code>{r.recipient}</code><span className="ms-small-tag">{r.status}</span>
        {(r.status === 'pending' || r.status === 'authorized' && BigInt(r.deadline || '0') < now) && <><label className="ms-check"><input type="checkbox" checked={!!verified[r.id]} onChange={e => setVerified(v => ({ ...v, [r.id]: e.target.checked }))}/>I independently verified this person and this exact wallet.</label><div className="ms-inline-actions"><button className="ms-button ms-primary" disabled={action.busy || !connected || !verified[r.id]} onClick={() => approve(r)}>Approve wallet<Check size={15}/></button><button className="ms-button ms-secondary" disabled={action.busy || !connected || r.status !== 'pending'} onClick={() => reject(r)}>Decline</button></div></>}
        {r.status === 'authorized' && BigInt(r.deadline || '0') >= now && <p className="ms-fine">Approved until {date(BigInt(r.deadline!))}. The recipient can now claim.</p>}
      </div>)}</div>}
      {!sender && active && (!mine ? <button className="ms-button ms-primary ms-full" disabled={action.busy || !connected} onClick={requestClaim}>Request to claim<ArrowUpRight size={16}/></button> : mine.status === 'authorized' ? <><button className="ms-button ms-primary ms-full" disabled={action.busy || !connected || BigInt(mine.deadline || '0') < now} onClick={() => transact()}>Claim payment<ArrowDownLeft size={17}/></button><p className="ms-fine">{BigInt(mine.deadline || '0') < now ? 'Approval expired. Ask the sender to renew it.' : 'Your wallet pays the claim’s Sepolia network gas.'}</p></> : <div className="ms-modal-note"><ShieldCheck size={17}/><span>{mine.status === 'rejected' ? 'This wallet’s request was declined.' : 'Your request is waiting for sender approval.'}</span></div>)}
      {sender && p.status === 1 && p.expiry <= now && <button className="ms-button ms-primary ms-full" disabled={action.busy || !connected} onClick={() => transact(true)}>Refund unclaimed ETH<ArrowDownLeft size={17}/></button>}
      {action.error && <p className="ms-alert" role="alert">{action.error}</p>}{requests.error && <p className="ms-alert">Claim requests are temporarily unavailable. The on-chain payment is unchanged.</p>}{action.notice && <p className="ms-fine" role="status">{action.notice}</p>}
      {action.busy && <div className="ms-busy"><LoaderCircle size={17} className="spin"/>Waiting for your wallet or the network…</div>}
      {hash && <a className="ms-text" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View confirmed transaction<ExternalLink size={14}/></a>}
    </>}
    <div className="ms-inline-actions ms-review-footer"><button className="ms-button ms-secondary" onClick={async () => { try { await navigator.clipboard.writeText(linkFor(id)); chat.notify('Payment link copied.'); } catch { chat.notify('Clipboard unavailable. Open the payment page to copy its URL.'); } }}><Link2 size={15}/>Copy link</button><a className="ms-text" href={`/pay/${id}`} target="_blank" rel="noreferrer">Full payment page<ExternalLink size={13}/></a></div>
    <p className="ms-fine">Sepolia test ETH only. Verify the recipient independently. Signed approvals cannot be revoked before their deadline.</p>
  </Modal>;
}
