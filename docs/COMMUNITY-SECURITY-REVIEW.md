# GhostPay community security review — 2026-10-19

**Internal, tool-assisted review. Not an independent audit, formal verification, certification or guarantee of safety. Testnets only. No community contract was deployed or funded on a public network by the agent.**

## Reviewed scope and reproducible artifacts

- `contracts/contracts/GhostPayCommunity.sol`, Solidity 0.8.28, optimizer 200 runs, Paris EVM target. Native coins only; separate instance per EVM testnet. The standalone Solidity contract does not prohibit mainnet deployment; testnet restrictions are enforced by the app/network catalog, not an on-chain chain-ID allowlist.
- Source SHA-256: `a0040a2a570dfdae233b8bdfd93244222aacfcda6a3e9200927cd176e6a3337e`.
- Creation bytecode Keccak-256: `0x64413112bc7c0fe8f8dcd60472a9ebecc72f98721924c232c82cd1f354b9c4a0`.
- Runtime bytecode Keccak-256: `0xdacf0a5a01d760274e751dde40cebf2addaabe7621898c5301085cdd6bc432f2`.
- Full machine-readable Slither 0.11.6 output: [community-slither.json](community-slither.json). The new artifact is `frontend/public/contracts/community.json` version 2; original version-1 code remains at `community-v1.json` for verified existing claim/refund access. New funding accepts only the current reviewed code. Neither version has an upgrade mechanism.

Git preserves the exact reviewed source bytes (including line endings) so Windows/Linux checkouts reproduce the same source and compiler-metadata hashes. The scan also checks that the written review matches the current source/creation/runtime hashes.

## Threat model and properties checked

An outsider, eligible recipient, organizer or malicious receiver contract may call any public method in any order. A payment link may be copied; the claimant may be offline; a recipient may reject ETH; a callback may reenter the same/different campaign or another mutation. Eligibility is the exact wallet, not a Google identity or Matrix membership.

1. **Exact funding:** the deposit equals the positive allocation sum; 1–100 unique, nonzero wallets. Duplicate aliases resolving to one wallet are also rejected in the frontend review. Allocation to the escrow itself is rejected because it can never originate a claim.
2. **Authorization:** only `msg.sender` receives its own immutable allocation once. No signature, relayer, delegate, owner or administrative drain exists in this community contract. An organizer cannot reduce/change an allocation or refund before expiry.
3. **Accounting:** before refund, `remaining + sum(successful allocations paid) == total`; across all campaigns, aggregate remaining liabilities never exceed the native balance. Claiming/refunding one pool cannot spend another pool’s reserve.
4. **Expiry:** claims require `timestamp < expiry`; refunds require `timestamp >= expiry`. The organizer alone refunds the remaining amount once. Boundary and out-of-range-window tests cover this split.
5. **Callbacks/failures:** all state writes share one reentrancy lock. Effects and events precede the external send. A failed transfer reverts all effects/events, retaining the allocation or refundable remainder. Callback attempts to claim another pool, refund or create a pool are blocked.
6. **Frontend provenance:** runtime and init code, chain/domain, successful creation receipt/address, canonical block and two confirmations are verified. Imported deployments need a creation hash; factory/proxy deployments are unsupported. Claims/refunds reject replacement/cancellation receipts and require the matching completion event. Amount/party review remains mandatory before funding.

## Findings and disposition

| Finding | Severity / disposition |
| --- | --- |
| Self-allocation could create an unclaimable allocation | Low, fixed: reject `address(this)`; failed-creation rollback regression added |
| Allocation preview said “fully funded” before funding | UI correctness, fixed: now “allocation plan” |
| Callback event-order notice from Slither | Hardened: completion events precede external sends and revert together on failure; shared guard retained |
| Uninitialized-local notice for the accumulator | Clarified: explicit zero initialization; Solidity already default-initialized it |
| Expiry comparisons use block timestamps | Three Low static notices accepted: time is part of the protocol; chain-specific timestamp/sequencer assumptions apply; deadlines are not exact wall-clock guarantees |
| Low-level native sends | Two Informational notices accepted: deliberate to support smart-contract receivers; return value checked, CEI and shared lock tested |

Final Slither run: **102 detectors; zero High, zero Medium, three Low, two Informational results**. This is the result of this tool on this scope, not proof that no other vulnerabilities exist. No detectors were globally excluded to obtain this result.

## Validation and reproducibility

```sh
npm ci
npm run compile
npm run test -w contracts
npm run test:messenger
npm run test:matrix
# Install slither-analyzer 0.11.6 and Solidity 0.8.28 first.
# Set SOLC_PATH if your compiler is not on PATH/the usual Windows Hardhat cache.
npm run security:community
```

The full contract suite passes 61 tests, including 14 community tests. Added maximum-100 gas-budget validation (<12 million gas in the isolated EVM), 50-recipient allocation checks, deterministic randomized 12-pool/48-action accounting checks, cross-function/pool reentrancy, failed sends, over/underfunding, UTF-8 title bounds, checked overflow, exact expiry and forced-Ether isolation. This is bounded randomized testing, not exhaustive fuzzing. Test fixtures deliberately use creation-time selfdestruct solely to force surplus Ether; the production contract has no selfdestruct. Real networks have different gas/block limits.

## Residual risks and exclusions

- No recovery or delegated claim: loss of a recipient key or a recipient contract unable to receive funds leaves its allocation unclaimable until the organizer can refund after expiry. A contract organizer unable to receive native coins may strand its refund. No admin rescue is added because it would create another withdrawal authority.
- Forced native currency is outside allocation accounting and cannot be swept. A normal unsolicited send reverts; force-sends can still leave surplus locked.
- Wallets, titles, amounts and activity are public. The permanent GhostPay directory is centrally operated, not ENS and not a proof of human identity. Verify first-time destinations independently. Chat membership cannot revoke/change funded rights.
- Recipients need their own testnet gas. No gas sponsorship, bridges, ERC-20, mainnet UI, transaction indexer or durable cross-device pending recovery is provided.
- A compromised frontend/provider/directory/RPC, stolen key, chain reorg/outage, wallet/account-recovery weakness or incorrect address selection can still cause loss. Two confirmations are a UI threshold, not an absolute-finality guarantee.
- This review does not audit Reown, Matrix, Google, the original escrow contracts, hosting dependencies or the whole application. Matrix has no live host/domain yet; actual Google authorization and public funded lifecycles have not been performed. External review and live lifecycle checks remain prerequisites before considering real-money use.
