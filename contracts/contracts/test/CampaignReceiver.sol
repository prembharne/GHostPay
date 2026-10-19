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
