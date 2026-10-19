// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title GhostPay Community
/// @notice Fully funded native-coin allocations; deploy separately on each EVM testnet.
/// @dev No owner, upgrade, delegated claim, fee, or early withdrawal path exists.
///      For each active campaign: remaining + sum(successful claims) == total.
///      Aggregate liabilities never exceed the contract balance. Forced Ether is
///      not a campaign allocation and has no rescue path. All writes share one lock.
contract GhostPayCommunity {
    struct Campaign {
        address organizer;
        uint256 total;
        uint256 remaining;
        uint256 expiry;
        uint256 claimedCount;
        bool refunded;
        string title;
    }

    uint256 public nextCampaignId = 1;
    uint256 private entered = 1;
    uint256 private constant MAX_RECIPIENTS = 100;
    uint256 private constant MIN_WINDOW = 1 minutes;
    uint256 private constant MAX_WINDOW = 30 days;
    mapping(uint256 => Campaign) private campaigns;
    mapping(uint256 => address[]) private recipients;
    mapping(uint256 => mapping(address => uint256)) public allocation;
    mapping(uint256 => mapping(address => bool)) public claimed;

    error InvalidCampaign();
    error InvalidAllocation();
    error NotEligible();
    error AlreadyClaimed();
    error Expired();
    error NotExpired();
    error NotOrganizer();
    error TransferFailed();
    error ReentrantCall();
    event CampaignCreated(uint256 indexed campaignId, address indexed organizer, uint256 total, uint256 expiry, uint256 count);
    event AllocationClaimed(uint256 indexed campaignId, address indexed recipient, uint256 amount);
    event RemainderRefunded(uint256 indexed campaignId, address indexed organizer, uint256 amount);

    modifier guard() {
        if (entered != 1) revert ReentrantCall();
        entered = 2;
        _;
        entered = 1;
    }

    function domainChainId() external view returns (uint256) { return block.chainid; }
    function getCampaign(uint256 id) external view returns (Campaign memory) { return campaigns[id]; }
    function getRecipients(uint256 id) external view returns (address[] memory) { return recipients[id]; }

    /// @notice Create immutable eligibility and fund every allocation in this transaction.
    /// @dev Rejects self-allocation: this contract cannot originate its own claim.
    function createCampaign(string calldata title, address[] calldata wallets, uint256[] calldata amounts, uint256 expiry)
        external payable guard returns (uint256 id)
    {
        uint256 count = wallets.length;
        if (count == 0 || count > MAX_RECIPIENTS || count != amounts.length || bytes(title).length == 0 || bytes(title).length > 120
            || expiry < block.timestamp + MIN_WINDOW || expiry > block.timestamp + MAX_WINDOW) revert InvalidCampaign();
        id = nextCampaignId++;
        uint256 total = 0;
        for (uint256 i = 0; i < count; ++i) {
            address recipient = wallets[i];
            if (recipient == address(0) || recipient == address(this) || amounts[i] == 0 || allocation[id][recipient] != 0) revert InvalidAllocation();
            allocation[id][recipient] = amounts[i];
            recipients[id].push(recipient);
            total += amounts[i];
        }
        if (total != msg.value || total == 0) revert InvalidAllocation();
        campaigns[id] = Campaign(msg.sender, total, total, expiry, 0, false, title);
        emit CampaignCreated(id, msg.sender, total, expiry, count);
    }

    /// @notice Only the allocated wallet may claim, once, strictly before expiry.
    function claim(uint256 id) external guard {
        Campaign storage c = campaigns[id];
        if (c.organizer == address(0) || c.refunded) revert InvalidCampaign();
        if (block.timestamp >= c.expiry) revert Expired();
        uint256 amount = allocation[id][msg.sender];
        if (amount == 0) revert NotEligible();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();
        claimed[id][msg.sender] = true;
        c.claimedCount++;
        c.remaining -= amount;
        emit AllocationClaimed(id, msg.sender, amount);
        // Effects and event roll back together if the recipient rejects payment.
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Only the organizer may recover unclaimed funds, at/after expiry.
    function refund(uint256 id) external guard {
        Campaign storage c = campaigns[id];
        if (c.organizer != msg.sender) revert NotOrganizer();
        if (block.timestamp < c.expiry) revert NotExpired();
        if (c.refunded || c.remaining == 0) revert InvalidCampaign();
        uint256 amount = c.remaining;
        c.remaining = 0;
        c.refunded = true;
        emit RemainderRefunded(id, msg.sender, amount);
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
