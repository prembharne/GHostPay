// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface ICommunity { function claim(uint256 id) external; function refund(uint256 id) external; function createCampaign(string calldata title,address[] calldata wallets,uint256[] calldata amounts,uint256 expiry) external payable returns(uint256); }
contract CampaignReceiver {
 ICommunity private escrow; uint256 private id; bool public blocked; bool public reject;
 constructor(address target){escrow=ICommunity(target);}
 function setReject(bool value) external {reject=value;}
 function claim(uint256 value) external {id=value;escrow.claim(id);}
 function fund(address[] calldata wallets,uint256[] calldata amounts,uint256 expiry) external payable {escrow.createCampaign{value:msg.value}("Test campaign",wallets,amounts,expiry);}
 function refund(uint256 value) external {escrow.refund(value);}
 receive() external payable {require(!reject,"reject");try escrow.claim(id){blocked=false;}catch{blocked=true;}}
}

/// @dev Tries every mutation from a receiving callback, including cross-campaign claims.
contract CrossCampaignReceiver {
 ICommunity private immutable escrow;
 uint256 private otherId;
 bool public claimBlocked;
 bool public refundBlocked;
 bool public createBlocked;
 constructor(address target){escrow=ICommunity(target);}
 function claim(uint256 value,uint256 other) external {otherId=other;escrow.claim(value);}
 receive() external payable {
  try escrow.claim(otherId){claimBlocked=false;}catch{claimBlocked=true;}
  try escrow.refund(otherId){refundBlocked=false;}catch{refundBlocked=true;}
  address[] memory wallets=new address[](1);wallets[0]=address(this);
  uint256[] memory amounts=new uint256[](1);amounts[0]=1;
  try escrow.createCampaign{value:1}("Reentry",wallets,amounts,block.timestamp+3600){createBlocked=false;}catch{createBlocked=true;}
 }
}
/// @dev Creation-time selfdestruct forces surplus Ether without a receive function.
contract ForceCampaignEther { constructor(address payable target) payable {selfdestruct(target);} }
