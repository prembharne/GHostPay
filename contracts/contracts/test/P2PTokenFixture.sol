// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @dev Adversarial token, used only in local escrow tests, never in the factory.
contract P2PTokenFixture is ERC20 {
    bool public reject;
    bool public tax;
    constructor() ERC20("Fixture", "FIX") { _mint(msg.sender, 1000000000); }
    function setReject(bool value) external { reject = value; }
    function setTax(bool value) external { tax = value; }
    function _update(address from, address to, uint256 value) internal override {
        require(!reject, "RejectedTransfer");
        if (tax && from != address(0) && to != address(0) && value > 1) {
            super._update(from, address(0), 1); value -= 1;
        }
        super._update(from, to, value);
    }
}
