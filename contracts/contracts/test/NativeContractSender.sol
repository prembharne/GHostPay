// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface INativeEscrow { function createNativePayment(uint256 expiry) external payable returns (uint256); }
/// @dev Test fixture only, never used by the application.
contract NativeContractSender {
    bytes32 private approvedDigest;
    bytes32 private approvedSignature;
    bool private enabled;
    function fund(address escrow, uint256 expiry) external payable { INativeEscrow(escrow).createNativePayment{value: msg.value}(expiry); }
    function approve(bytes32 digest, bytes calldata signature, bool valid) external { approvedDigest = digest; approvedSignature = keccak256(signature); enabled = valid; }
    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) { return enabled && digest == approvedDigest && keccak256(signature) == approvedSignature ? bytes4(0x1626ba7e) : bytes4(0xffffffff); }
    receive() external payable {}
}
