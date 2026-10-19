import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits, type Address } from 'viem';
import { ArrowUpRight, Check, Copy, LoaderCircle, Search, Send, ShieldCheck } from 'lucide-react';
import { networkById } from '../../../shared/evm-networks';
import { amountInNative } from '../../../shared/amounts';
import { type DirectReference, directReference } from '../../../shared/direct';
import type { MarketQuote } from '../../../shared/market';
import type { PaymentReference } from '../messenger/model';
import { useAction } from '../hooks/useAction';
import { useNativeWallet } from './useNativeWallet';
import { nativeClient } from './native';
import { NetworkPicker } from './NetworkPicker';
import { AmountField } from './AmountField';
import { useMarket } from './useMarket';
import { profileApi, resolveRecipient } from './identity';
export function directHistory(): DirectReference[] { try { const values = JSON.parse(localStorage.getItem('ghostpay.direct.v1') || '[]'); return Array.isArray(values) ? values.map(directReference).filter(Boolean).slice(0,100) as DirectReference[] : []; } catch { return []; } }
export function DirectPayment({ recipient, onShare, onLock }: { recipient?: string; onShare?: (body: string, ref: PaymentReference) => Promise<void>; onLock?(locked: boolean): void }) {
 const [network,setNetwork]=useState(()=>networkById(11155111)!);const [to,setTo]=useState('');const [amount,setAmount]=useState('');const [mode,setMode]=useState<'usd'|'native'>('usd');const [checked,setChecked]=useState(false);
 const [review,setReview]=useState<{address:Address;label:string;input:string;units:bigint;quote?:MarketQuote}>(); const [submitted,setSubmitted]=useState<DirectReference>(); const [confirmed,setConfirmed]=useState(false);const [shared,setShared]=useState(false);
 const action=useAction();const wallet=useNativeWallet(network.id);const market=useMarket(network.symbol);
 const search=to.trim().replace(/^@/,'').toLowerCase(); const suggestions=useQuery<{username:string;wallet:Address}[]>({queryKey:['profile-search',search],queryFn:()=>profileApi(`/search/${search}`),enabled:/^[a-z][a-z0-9_]{1,23}$/.test(search)&&!review,staleTime:10000,retry:0});
 useEffect(()=>{onLock?.(action.busy||!!submitted);},[action.busy,submitted]);
 async function prepare(e:FormEvent){e.preventDefault();await action.run(async()=>{const value=amountInNative(amount,mode,network.decimals,market.quote);const target=await resolveRecipient(to);if(target.address.toLowerCase()===wallet.address?.toLowerCase())throw new Error('This is your own wallet. Choose the intended recipient.');setReview({...target,input:to,units:value.units,quote:market.quote});setChecked(false);});}
 async function share(ref:DirectReference){if(onShare){await onShare(`A direct ${network.symbol} payment for ${review?.label || 'you'}. ${network.explorer}/tx/${ref.hash}`,ref);setShared(true);}}
 async function send(){await action.run(async()=>{
   if(confirmed&&submitted){await share(submitted);return;}
   let ref=submitted;
   if(!ref){if(!review||!checked)throw new Error('Review and confirm the exact recipient first.');const target=await resolveRecipient(review.input);if(target.address.toLowerCase()!==review.address.toLowerCase())throw new Error('The recipient address changed. Review again.');const signer=await wallet.wallet();if(mode==='usd')amountInNative(amount,mode,network.decimals,review.quote);const hash=await signer.sendTransaction({to:review.address,value:review.units});ref={version:3,chainId:network.id,hash,from:signer.account.address,to:review.address};setSubmitted(ref);}
   action.setNotice('Transfer submitted. Checking this same transaction for two confirmations…');const client=nativeClient(network.id);const receipt=await client.waitForTransactionReceipt({hash:ref.hash,confirmations:2});if(receipt.status!=='success')throw new Error('The transfer reverted. Check its explorer record before starting again.');const block=await client.getBlock({blockNumber:receipt.blockNumber});if(block.hash!==receipt.blockHash)throw new Error('The confirmation block changed. Check this same transaction again.');setConfirmed(true);
   try{localStorage.setItem('ghostpay.direct.v1',JSON.stringify([ref,...directHistory().filter(p=>p.hash!==ref!.hash)].slice(0,100)));}catch{}
   action.setNotice('The direct transfer is confirmed.');await share(ref);
 });}
 return <><p className="ms-modal-copy">{recipient ? `Pay ${recipient} directly. ` : 'Pay a person directly. '}Find their unique GhostPay username. No escrow or claim link is needed.</p><form className="ms-form gp-native-form" onSubmit={prepare}>
 <NetworkPicker network={network} disabled={action.busy||!!submitted} onChange={next=>{setNetwork(next);setAmount('');setReview(undefined);setMode('native');}}/>
 <label htmlFor="direct-recipient">Recipient username</label><div className="gp-recipient-search"><Search size={17}/><input id="direct-recipient" value={to} onChange={e=>{setTo(e.target.value);setReview(undefined);}} placeholder="@username" required maxLength={60} disabled={action.busy||!!submitted}/></div>
 {!review&&suggestions.data?.length ? <div className="gp-people-results">{suggestions.data.map(person=><button type="button" key={person.wallet} onClick={()=>setTo(`@${person.username}`)}><span>@{person.username}</span><small>{person.wallet.slice(0,6)}…{person.wallet.slice(-4)}</small><ArrowUpRight size={14}/></button>)}</div>:null}
 <p className="ms-fine">No username yet? A full EVM wallet address also works. A chat display name alone is not a payment identity.</p>
 <AmountField id="direct-amount" symbol={network.symbol} decimals={network.decimals} value={amount} onChange={value=>{setAmount(value);setReview(undefined);}} mode={mode} setMode={value=>{setMode(value);setReview(undefined);}} disabled={action.busy||!!submitted} fixedQuote={review?.quote}/>
 {!review&&!submitted&&<button className="ms-button ms-primary" disabled={action.busy}>{action.busy?<LoaderCircle className="spin" size={17}/>:<ShieldCheck size={17}/>}Review payment</button>}
 {review&&<div className="gp-direct-review"><span className="ms-kicker">REVIEW THE EXACT DESTINATION</span><h3>{review.label}</h3><code>{review.address}</code><strong>{formatUnits(review.units,network.decimals)} {network.symbol}</strong><p>{network.name} · network gas is additional</p><label className="ms-check"><input type="checkbox" checked={checked} disabled={!!submitted} onChange={e=>setChecked(e.target.checked)}/>I verified this recipient and network. A confirmed direct transfer cannot be refunded through GhostPay.</label><button type="button" className="ms-button ms-primary ms-full" disabled={action.busy||!checked||confirmed&&(!onShare||shared)} onClick={send}>{action.busy?<LoaderCircle className="spin" size={17}/>:confirmed?<Check size={17}/>:<Send size={17}/>} {confirmed?onShare&&!shared?'Share confirmed receipt':'Payment confirmed':submitted?'Check submitted transfer':'Confirm & send directly'}</button></div>}
 {submitted&&network.explorer&&<a className="ms-text" href={`${network.explorer}/tx/${submitted.hash}`} target="_blank" rel="noreferrer">{confirmed?'View confirmed transfer':'View submitted transaction'}<ArrowUpRight size={14}/></a>}
 {action.error&&<p className="ms-alert" role="alert">{action.error}</p>}{action.notice&&<p className="ms-fine" role="status">{action.notice}</p>}
 </form></>;
}
