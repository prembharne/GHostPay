import { getAddress, type Address, type Hex } from 'viem';
import { communityAbi, campaignReference, type CampaignReference } from '../../../shared/community';
import { checkRpc, nativeClient, verifyCreation } from './native';
import { requireTestnet } from '../../../shared/nativeProtocol';
export interface CommunityArtifact { bytecode: Hex; deployedBytecode: Hex; version: number; testnetOnly: boolean; evmVersion: string }
let pending:Promise<CommunityArtifact>|undefined;
let previous:Promise<CommunityArtifact>|undefined;
async function loadArtifact(path:string,version:number){const r=await fetch(path);if(!r.ok)throw new Error('Community contract artifact unavailable.');const a=await r.json();if(a.version!==version||a.evmVersion!=='paris'||a.testnetOnly!==true||!/^0x[\da-f]+$/i.test(a.bytecode)||!/^0x[\da-f]+$/i.test(a.deployedBytecode))throw new Error('Invalid community contract artifact.');return a as CommunityArtifact;}
export function communityArtifact(){return pending ||= loadArtifact('/contracts/community.json',2).catch(e=>{pending=undefined;throw e;});}
function previousArtifact(){return previous ||= loadArtifact('/contracts/community-v1.json',1).catch(e=>{previous=undefined;throw e;});}
export async function verifyCommunity(id:number,value:string,creationHash:string,allowPrevious=false){
 requireTestnet(id);const address=getAddress(value);await checkRpc(id);
 const [current,code]=await Promise.all([communityArtifact(),nativeClient(id).getCode({address})]);
 let trusted=current;
 if(code?.toLowerCase()!==current.deployedBytecode.toLowerCase()){
  if(!allowPrevious)throw new Error('This is not the current GhostPay community contract. Deploy or import the reviewed version before funding a new campaign.');
  trusted=await previousArtifact();if(code?.toLowerCase()!==trusted.deployedBytecode.toLowerCase())throw new Error('This is not a recognized GhostPay community contract.');
 }
 if(await nativeClient(id).readContract({address,abi:communityAbi,functionName:'domainChainId'})!==BigInt(id))throw new Error('Community contract returned a different chain.');
 await verifyCreation(id,address,creationHash,trusted.bytecode);return address;
}
export function communityCreation(id:number,address:string):string{try{return JSON.parse(localStorage.getItem('ghostpay.community.creation')||'{}')[`${id}:${address.toLowerCase()}`]||'';}catch{return '';}}
export function savedCommunity(id:number):string{try{return JSON.parse(localStorage.getItem('ghostpay.community.contracts')||'{}')[id]||'';}catch{return '';}}
export function saveCommunity(id:number,address:Address,creationHash:string){let previous={};try{previous=JSON.parse(localStorage.getItem('ghostpay.community.contracts')||'{}');}catch{}try{localStorage.setItem('ghostpay.community.contracts',JSON.stringify({...previous,[id]:address}));let proofs={};try{proofs=JSON.parse(localStorage.getItem('ghostpay.community.creation')||'{}');}catch{}localStorage.setItem('ghostpay.community.creation',JSON.stringify({...proofs,[`${id}:${address.toLowerCase()}`]:creationHash}));}catch{}}
export function campaignHistory():CampaignReference[]{try{const values=JSON.parse(localStorage.getItem('ghostpay.campaigns')||'[]');return Array.isArray(values)?values.map(campaignReference).filter(Boolean).slice(0,100) as CampaignReference[]:[];}catch{return [];}}
export function saveCampaign(ref:CampaignReference){try{localStorage.setItem('ghostpay.campaigns',JSON.stringify([ref,...campaignHistory().filter(p=>!(p.chainId===ref.chainId&&p.contract===ref.contract&&p.campaignId===ref.campaignId))].slice(0,100)));}catch{}}
