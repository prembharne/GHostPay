// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title GhostPay — sender-authorized, wallet-bound ETH payment links.
/// @notice Experimental hackathon escrow. Transparent, permissionless, and not audited.
contract GhostPayEscrow is EIP712, ReentrancyGuard {
    enum PaymentStatus { None, Active, Claimed, Refunded }
    struct Payment {
        address sender;
        address token;
        uint256 amount;
        uint256 expiry;
        PaymentStatus status;
    }

    uint256 public constant MIN_EXPIRY = 60;
    uint256 public constant MAX_EXPIRY = 30 days;
    bytes32 public constant CLAIM_TYPEHASH = keccak256("ClaimAuthorization(uint256 paymentId,address recipient,uint256 deadline)");
    uint256 public nextPaymentId = 1;
    mapping(uint256 => Payment) public payments;

    error ZeroAmount();
    error InvalidExpiry();
    error PaymentNotActive();
    error PaymentExpired();
    error InvalidDeadline();
    error InvalidRecipient();
    error InvalidSignature();
    error NotSender();
    error NotExpired();
    error TransferFailed();

    event PaymentCreated(uint256 indexed paymentId, address indexed sender, address token, uint256 amount, uint256 expiry);
    event PaymentClaimed(uint256 indexed paymentId, address indexed recipient, uint256 amount);
    event PaymentRefunded(uint256 indexed paymentId, address indexed sender, uint256 amount);

    constructor() EIP712("GhostPay", "1") {}

    /// @notice Deposit ETH without knowing the recipient. Expiry must be 1 minute to 30 days away.
    function createETHPayment(uint256 expiry) external payable nonReentrant returns (uint256 paymentId) {
        if (msg.value == 0) revert ZeroAmount();
        if (expiry < block.timestamp + MIN_EXPIRY || expiry > block.timestamp + MAX_EXPIRY) revert InvalidExpiry();
        paymentId = nextPaymentId++;
        payments[paymentId] = Payment(msg.sender, address(0), msg.value, expiry, PaymentStatus.Active);
        emit PaymentCreated(paymentId, msg.sender, address(0), msg.value, expiry);
    }

    /// @notice Only the sender-approved recipient can submit a claim, once, before expiry.
    function claimPayment(uint256 paymentId, address recipient, uint256 authorizationDeadline, bytes calldata signature) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (payment.status != PaymentStatus.Active) revert PaymentNotActive();
        if (block.timestamp >= payment.expiry) revert PaymentExpired();
        if (block.timestamp > authorizationDeadline || authorizationDeadline > payment.expiry) revert InvalidDeadline();
        if (recipient == address(0) || msg.sender != recipient) revert InvalidRecipient();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(CLAIM_TYPEHASH, paymentId, recipient, authorizationDeadline)));
        if (!SignatureChecker.isValidSignatureNow(payment.sender, digest, signature)) revert InvalidSignature();
        payment.status = PaymentStatus.Claimed;
        _sendETH(recipient, payment.amount);
        emit PaymentClaimed(paymentId, recipient, payment.amount);
    }

    /// @notice Return the entire unclaimed deposit to its sender at or after expiry.
    function refundPayment(uint256 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (payment.status != PaymentStatus.Active) revert PaymentNotActive();
        if (msg.sender != payment.sender) revert NotSender();
        if (block.timestamp < payment.expiry) revert NotExpired();
        payment.status = PaymentStatus.Refunded;
        _sendETH(payment.sender, payment.amount);
        emit PaymentRefunded(paymentId, payment.sender, payment.amount);
    }

    /// @notice All display and authorization data should be read from this on-chain record.
    function getPayment(uint256 paymentId) external view returns (Payment memory) { return payments[paymentId]; }

    function _sendETH(address recipient, uint256 amount) private {
        (bool success,) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
    }
}
