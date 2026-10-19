import { getAddress, isAddress, parseAbi, type Address } from 'viem';
import { validId, requireTestnet } from './nativeProtocol.js';
export const communityAbi = parseAbi([
 'function createCampaign(string title,address[] wallets,uint256[] amounts,uint256 expiry) payable returns (uint256 id)',
 'function getCampaign(uint256 id) view returns ((address organizer,uint256 total,uint256 remaining,uint256 expiry,uint256 claimedCount,bool refunded,string title))',
 'function getRecipients(uint256 id) view returns (address[])', 'function allocation(uint256 id,address wallet) view returns (uint256)', 'function claimed(uint256 id,address wallet) view returns (bool)',
 'function claim(uint256 id)', 'function refund(uint256 id)', 'function domainChainId() view returns (uint256)',
 'event CampaignCreated(uint256 indexed campaignId,address indexed organizer,uint256 total,uint256 expiry,uint256 count)',
 'event AllocationClaimed(uint256 indexed campaignId,address indexed recipient,uint256 amount)',
 'event RemainderRefunded(uint256 indexed campaignId,address indexed organizer,uint256 amount)',
]);
export interface CampaignReference { version: 4; chainId: number; contract: Address; campaignId: string; deploymentHash: string }
export function campaignReference(value: unknown): CampaignReference | undefined {
 try { const p = value as CampaignReference; if (p?.version !== 4 || !isAddress(p.contract) || /^0x0{40}$/i.test(p.contract) || !validId(p.campaignId) || !/^0x[\da-fA-F]{64}$/.test(p.deploymentHash || '')) return; requireTestnet(p.chainId); return { version: 4, chainId: p.chainId, contract: getAddress(p.contract), campaignId: p.campaignId, deploymentHash: p.deploymentHash }; } catch { return; }
}
export const campaignPath = (p: CampaignReference) => `/campaign/${p.chainId}/${p.contract}/${p.campaignId}?deployment=${p.deploymentHash}`;
