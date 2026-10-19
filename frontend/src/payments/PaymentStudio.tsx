import { useState } from 'react';
import { Link2, Send, Users } from 'lucide-react';
import { Modal } from '../messenger/Modal';
import type { PaymentReference } from '../messenger/model';
import { NativeComposer } from './NativeComposer';
import { DirectPayment } from './DirectPayment';
import { CampaignComposer } from './CampaignComposer';
import './payments.css';
export function PaymentStudio({onClose,onShare,recipient,group=false,standalone=false}:{onClose():void;onShare?:(body:string,ref:PaymentReference)=>Promise<void>;recipient?:string;group?:boolean;standalone?:boolean}){
 const [mode,setMode]=useState<'person'|'community'|'link'>(()=>group||new URLSearchParams(window.location.search).get('mode')==='community'?'community':'person');const [locked,setLocked]=useState(false);
 const title=mode==='person'?'A familiar name. A direct payment.':mode==='community'?'A little for everyone.':'A payment, without the address.';
 const content=<><div className="gp-payment-tabs" role="tablist" aria-label="Payment type">{([{id:'person',name:'Pay a person',Icon:Send},{id:'community',name:'Community fund',Icon:Users},{id:'link',name:'Payment link',Icon:Link2}] as const).map(tab=><button type="button" key={tab.id} role="tab" aria-selected={mode===tab.id} disabled={locked&&mode!==tab.id} onClick={()=>setMode(tab.id)}><tab.Icon size={16}/><span>{tab.name}</span></button>)}</div><div role="tabpanel" aria-label={mode==='person'?'Direct payment':mode==='community'?'Community campaign':'Payment link'}>{mode==='person'?<DirectPayment recipient={recipient} onShare={onShare} onLock={setLocked}/>:mode==='community'?<CampaignComposer recipient={recipient} onShare={onShare} onLock={setLocked}/>:<NativeComposer inline onClose={onClose} recipient={recipient} onShare={onShare} onLock={setLocked}/>}</div></>;
 return standalone?<section className="gp-native-standalone ms-modal-body"><p className="ms-kicker">PEOPLE FIRST. PAYMENTS SECOND.</p><h1>{title}</h1>{content}</section>:<Modal title={title} eyebrow="A PAYMENT, INSIDE THE CONVERSATION" onClose={onClose}>{content}</Modal>;
}
