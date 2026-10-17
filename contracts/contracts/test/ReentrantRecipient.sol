// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IEscrow {
    function claimPayment(uint256 id, address recipient, uint256 deadline, bytes calldata signature) external;
}
contract ReentrantRecipient {
    IEscrow public immutable escrow;
    uint256 private id;
    uint256 private deadline;
    bytes private signature;
    bool public reentryBlocked;
    bool public rejectTransfer;
    constructor(address target) { escrow = IEscrow(target); }
    function setReject(bool value) external { rejectTransfer = value; }
    function claim(uint256 paymentId, uint256 until, bytes calldata sig) external {
        id = paymentId; deadline = until; signature = sig;
        escrow.claimPayment(id, address(this), deadline, signature);
    }
    receive() external payable {
        require(!rejectTransfer, "reject transfer");
        try escrow.claimPayment(id, address(this), deadline, signature) { reentryBlocked = false; }
        catch { reentryBlocked = true; }
    }
}
