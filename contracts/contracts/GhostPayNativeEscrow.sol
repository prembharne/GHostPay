// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice One native-coin escrow implementation for EVM network deployments.
/// @dev Deploy separately on each network. No bridge, owner withdrawal or upgrade path.
contract GhostPayNativeEscrow {
    enum Status { None, Active, Claimed, Refunded }
    struct Payment { address sender; uint256 amount; uint256 expiry; Status status; }
    mapping(uint256 => Payment) private payments;
    uint256 public nextPaymentId = 1;
    uint256 private entered = 1;
    uint256 public constant MIN_EXPIRY = 1 minutes;
    uint256 public constant MAX_EXPIRY = 30 days;
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant CLAIM_TYPEHASH = keccak256("ClaimAuthorization(uint256 paymentId,address recipient,uint256 deadline)");
    bytes32 private constant NAME_HASH = keccak256("GhostPay");
    bytes32 private constant VERSION_HASH = keccak256("2");
    uint256 private constant HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    error ZeroAmount(); error InvalidExpiry(); error PaymentNotActive(); error PaymentExpired();
    error InvalidDeadline(); error InvalidRecipient(); error InvalidSignature(); error NotSender();
    error NotExpired(); error TransferFailed(); error ReentrantCall();
    event PaymentCreated(uint256 indexed paymentId, address indexed sender, uint256 amount, uint256 expiry);
    event PaymentClaimed(uint256 indexed paymentId, address indexed recipient, uint256 amount);
    event PaymentRefunded(uint256 indexed paymentId, address indexed sender, uint256 amount);

    modifier nonReentrant() { if (entered != 1) revert ReentrantCall(); entered = 2; _; entered = 1; }
    function domainChainId() external view returns (uint256) { return block.chainid; }
    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }
    function createNativePayment(uint256 expiry) external payable nonReentrant returns (uint256 paymentId) {
        if (msg.value == 0) revert ZeroAmount();
        if (expiry < block.timestamp + MIN_EXPIRY || expiry > block.timestamp + MAX_EXPIRY) revert InvalidExpiry();
        paymentId = nextPaymentId++;
        payments[paymentId] = Payment(msg.sender, msg.value, expiry, Status.Active);
        emit PaymentCreated(paymentId, msg.sender, msg.value, expiry);
    }
    function getPayment(uint256 paymentId) external view returns (Payment memory) { return payments[paymentId]; }
    function claimPayment(uint256 paymentId, address recipient, uint256 deadline, bytes calldata signature) external nonReentrant {
        Payment storage p = payments[paymentId];
        if (p.status != Status.Active) revert PaymentNotActive();
        if (block.timestamp >= p.expiry) revert PaymentExpired();
        if (block.timestamp > deadline || deadline > p.expiry) revert InvalidDeadline();
        if (recipient == address(0) || msg.sender != recipient) revert InvalidRecipient();
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", domainSeparator(), keccak256(abi.encode(CLAIM_TYPEHASH, paymentId, recipient, deadline))));
        if (!_validSignature(p.sender, digest, signature)) revert InvalidSignature();
        p.status = Status.Claimed;
        _send(recipient, p.amount);
        emit PaymentClaimed(paymentId, recipient, p.amount);
    }
    function refundPayment(uint256 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        if (p.status != Status.Active) revert PaymentNotActive();
        if (msg.sender != p.sender) revert NotSender();
        if (block.timestamp < p.expiry) revert NotExpired();
        p.status = Status.Refunded;
        _send(p.sender, p.amount);
        emit PaymentRefunded(paymentId, p.sender, p.amount);
    }
    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length != 0) {
            (bool ok, bytes memory result) = signer.staticcall(abi.encodeWithSelector(bytes4(0x1626ba7e), digest, signature));
            return ok && result.length >= 32 && abi.decode(result, (bytes4)) == bytes4(0x1626ba7e);
        }
        if (signature.length != 65) return false;
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(signature.offset) s := calldataload(add(signature.offset, 32)) v := byte(0, calldataload(add(signature.offset, 64))) }
        if (uint256(s) > HALF_ORDER || (v != 27 && v != 28)) return false;
        address recovered = ecrecover(digest, v, r, s);
        return recovered != address(0) && recovered == signer;
    }
    function _send(address recipient, uint256 amount) private {
        (bool ok,) = payable(recipient).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
