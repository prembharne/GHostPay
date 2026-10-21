// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Worthless, freely minted test tokens. Never Circle-issued USDC.
contract GhostPayMockUSDC is ERC20 {
    constructor() ERC20("GhostPay Sandbox USD", "gpUSD") { _testnet(); }
    function decimals() public pure override returns (uint8) { return 6; }
    function faucet() external { _testnet(); _mint(msg.sender, 100 * 1e6); }
    function _testnet() private view {
        require(block.chainid == 11155111 || block.chainid == 31337, "TestnetOnly");
    }
}

/// @notice Testnet settlement harness. The deployer attests SIMULATED INR payments.
/// @dev Not a bank verifier, ZK verifier, live USDC escrow, or audited production protocol.
contract GhostPayP2PSandboxEscrow is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    enum State { Missing, Offered, Accepted, PaymentReported, Disputed, Settled, Refunded }
    struct Trade {
        address seller;
        address buyer;
        uint256 gross;
        uint256 fee;
        uint256 inrPaise;
        uint256 rateMicros;
        uint256 acceptUntil;
        uint256 acceptedAt;
        uint256 payUntil;
        bytes32 payeeCommitment;
        bytes32 termsHash;
        bytes32 evidenceCommitment;
        State state;
    }
    IERC20 public immutable token;
    address public immutable attestor;
    address public immutable feeRecipient;
    uint256 public constant FEE_BPS = 50;
    uint256 public constant PAYMENT_WINDOW = 15 minutes;
    bytes32 public constant SETTLEMENT_TYPEHASH = keccak256("Settlement(uint256 tradeId,bytes32 termsHash,bytes32 evidenceCommitment,bytes32 nullifier,uint256 paidAt,uint256 validUntil)");
    uint256 public nextTradeId = 1;
    uint256 public liability;
    mapping(uint256 => Trade) private trades;
    mapping(bytes32 => bool) public consumedNullifiers;
    event Offered(uint256 indexed tradeId, address indexed seller, address indexed buyer, bytes32 termsHash);
    event StateChanged(uint256 indexed tradeId, State state);
    event Settled(uint256 indexed tradeId, bytes32 indexed nullifier, uint256 buyerAmount, uint256 fee);
    error InvalidTerms();
    error WrongParty();
    error WrongState();
    error Expired();
    error InvalidProof();
    error ReplayedProof();
    error UnsupportedToken();

    constructor(address token_, address attestor_, address feeRecipient_) EIP712("GhostPay P2P Sandbox", "1") {
        require(block.chainid == 11155111 || block.chainid == 31337, "TestnetOnly");
        if (token_ == address(0) || attestor_ == address(0) || feeRecipient_ == address(0) || feeRecipient_ == address(this)) revert InvalidTerms();
        token = IERC20(token_); attestor = attestor_; feeRecipient = feeRecipient_;
    }
    function getTrade(uint256 id) external view returns (Trade memory) { return trades[id]; }
    function createOffer(address buyer, uint256 gross, uint256 rateMicros, uint256 acceptUntil, bytes32 payeeCommitment) external nonReentrant returns (uint256 id) {
        if (buyer == address(0) || buyer == msg.sender || buyer == address(this) || gross < 1e6 || gross > 1000 * 1e6 || rateMicros < 50 * 1e6 || rateMicros > 200 * 1e6 || payeeCommitment == bytes32(0) || acceptUntil < block.timestamp + 1 minutes || acceptUntil > block.timestamp + 10 minutes) revert InvalidTerms();
        uint256 fee = Math.mulDiv(gross, FEE_BPS, 10000, Math.Rounding.Ceil);
        uint256 inrPaise = Math.mulDiv(gross, rateMicros, 1e10, Math.Rounding.Ceil);
        id = nextTradeId++;
        bytes32 terms = keccak256(abi.encode(block.chainid, address(this), id, msg.sender, buyer, gross, fee, inrPaise, rateMicros, acceptUntil, payeeCommitment, feeRecipient));
        trades[id] = Trade(msg.sender, buyer, gross, fee, inrPaise, rateMicros, acceptUntil, 0, 0, payeeCommitment, terms, bytes32(0), State.Offered);
        liability += gross;
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), gross);
        if (token.balanceOf(address(this)) - beforeBalance != gross) revert UnsupportedToken();
        emit Offered(id, msg.sender, buyer, terms);
    }
    function accept(uint256 id, bytes32 expectedTerms) external nonReentrant {
        Trade storage t = trades[id];
        if (msg.sender != t.buyer) revert WrongParty();
        if (t.state != State.Offered) revert WrongState();
        if (block.timestamp >= t.acceptUntil) revert Expired();
        if (expectedTerms != t.termsHash) revert InvalidTerms();
        t.acceptedAt = block.timestamp; t.payUntil = block.timestamp + PAYMENT_WINDOW;
        t.state = State.Accepted; emit StateChanged(id, t.state);
    }
    /// @notice A buyer report is not proof and NEVER releases funds.
    function reportPayment(uint256 id, bytes32 commitment) external nonReentrant {
        Trade storage t = trades[id];
        if (msg.sender != t.buyer) revert WrongParty();
        if (t.state != State.Accepted) revert WrongState();
        if (block.timestamp > t.payUntil) revert Expired();
        if (commitment == bytes32(0)) revert InvalidTerms();
        t.evidenceCommitment = commitment; t.state = State.PaymentReported;
        emit StateChanged(id, t.state);
    }
    function dispute(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        if (msg.sender != t.buyer && msg.sender != t.seller) revert WrongParty();
        if (t.state != State.Accepted && t.state != State.PaymentReported) revert WrongState();
        t.state = State.Disputed; emit StateChanged(id, t.state);
    }
    /// @notice Seller cancels an unaccepted offer. After acceptance, only the buyer
    /// may voluntarily forfeit their allocation back to the seller. No timeout sweep.
    function refund(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        if (t.state == State.Offered) { if (msg.sender != t.seller) revert WrongParty(); }
        else if (t.state == State.Accepted || t.state == State.PaymentReported || t.state == State.Disputed) { if (msg.sender != t.buyer) revert WrongParty(); }
        else revert WrongState();
        t.state = State.Refunded; liability -= t.gross;
        token.safeTransfer(t.seller, t.gross); emit StateChanged(id, t.state);
    }
    function settlementDigest(uint256 id, bytes32 nullifier, uint256 paidAt, uint256 validUntil) public view returns (bytes32) {
        Trade storage t = trades[id];
        return _hashTypedDataV4(keccak256(abi.encode(SETTLEMENT_TYPEHASH, id, t.termsHash, t.evidenceCommitment, nullifier, paidAt, validUntil)));
    }
    /// @notice Relayer or either party can submit an attestation. Payout destinations
    /// come only from the funded terms, never from the proof submitter.
    function settle(uint256 id, bytes32 nullifier, uint256 paidAt, uint256 validUntil, bytes calldata signature) external nonReentrant {
        Trade storage t = trades[id];
        if (t.state != State.PaymentReported && t.state != State.Disputed) revert WrongState();
        if (nullifier == bytes32(0) || t.evidenceCommitment == bytes32(0) || paidAt < t.acceptedAt || paidAt > t.payUntil || paidAt > block.timestamp || validUntil < block.timestamp || validUntil > t.payUntil + 2 days) revert InvalidProof();
        if (consumedNullifiers[nullifier]) revert ReplayedProof();
        if (!SignatureChecker.isValidSignatureNow(attestor, settlementDigest(id, nullifier, paidAt, validUntil), signature)) revert InvalidProof();
        consumedNullifiers[nullifier] = true; t.state = State.Settled; liability -= t.gross;
        token.safeTransfer(t.buyer, t.gross - t.fee); token.safeTransfer(feeRecipient, t.fee);
        emit Settled(id, nullifier, t.gross - t.fee, t.fee);
    }
}

/// @notice Only this exact factory is accepted by the GhostPay sandbox UI.
/// No constructor parameters, upgrade hooks, external token import, or admin withdrawals.
contract GhostPayP2PSandbox {
    address public token;
    address public escrow;
    address public attestor;
    constructor() {
        require(block.chainid == 11155111 || block.chainid == 31337, "TestnetOnly");
        token = address(new GhostPayMockUSDC());
        attestor = msg.sender;
        escrow = address(new GhostPayP2PSandboxEscrow(token, msg.sender, msg.sender));
    }
}
