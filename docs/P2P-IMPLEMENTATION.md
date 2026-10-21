# P2P INR ↔ USDC settlement: implemented boundaries

This release adds `/trade`, a real ERC-20 escrow lifecycle on Sepolia using **worthless gpUSD test tokens and simulated INR evidence**. It does not enable live UPI payments, Circle USDC deposits, or a production fiat on/off-ramp. No payment-proof provider access has been supplied. No public P2P contract was deployed or funded by the agent.

## What works now

- Responsive monochrome exchange page, exact amount/fee review, interactive four-step explanation, and a separate settlement workspace accessible from Messenger → Payments.
- A no-argument sandbox factory creates a six-decimal mock token and a fixed escrow. The deploying wallet becomes the **trusted simulated attestor and fee recipient**. Anyone can mint 100 mock tokens per faucet call; these are not scarcity-backed assets.
- Seller funds a named buyer's trade, using exact-amount token approval. Both see immutable gross tokens, 0.5% token fee, net buyer tokens, INR paise, illustrative rate, payee commitment and acceptance expiry. INR = gross × rate; fee is deducted from gross token payout, not added invisibly to INR. Rounding always uses integers and is disclosed by the displayed amounts.
- Buyer accepts the exact terms hash, then reports a **simulated** payment. Reporting alone pays nobody. Deployer signs an EIP-712 simulated-payment assertion; a relayer or either party can submit it. Only the named buyer and immutable fee recipient receive tokens.
- Public share links contain chain-fixed factory address, creation transaction and trade ID. Reads and writes verify the exact factory runtime, exact no-argument initcode, matching success receipt, canonical creation block, two confirmations and RPC chain ID. Factory constructor code fixes its children; arbitrary external token/verifier imports are not accepted by the UI.
- Signed assertions bind chain, escrow, trade ID, funded terms, evidence commitment, nullifier and timestamps. Consumed nullifiers prevent replay **within an escrow instance**. No bank data, UTR, credentials or evidence signatures are persisted by the app or service worker. Public deployment identifiers may be saved locally.

## Try it with two wallets

1. Open `/trade`, expand the settlement lab and acknowledge its test-only boundary. Connect wallet A on Sepolia, with test ETH for gas.
2. Deploy the sandbox using A's wallet approval. The page waits for two confirmations. Save its setup link; it is also remembered on this device.
3. Mint gpUSD. Enter wallet B as buyer and fund a trade using the amount above. Approve only that amount, then approve its escrow deposit. The example rate is **₹86.50 per token, an illustrative fixture**.
4. Share the trade link with B. B verifies the deployment, connects, reviews the on-chain terms, accepts before expiry, and reports a simulated INR payment within 15 minutes. **Do not send real UPI money.**
5. A opens the same trade and refreshes. As the sandbox attestor, A signs simulated payment evidence. A can relay it, or copy the JSON to B for submission. It is a demonstration of authenticated settlement, not bank authentication.
6. Submission verifies the signature and settles net gpUSD to B and fee gpUSD to A. Refresh checks actual on-chain state; the application does not fabricate completion from local steps.

Each sandbox is isolated. Tokens from another sandbox cannot fund this escrow. The UI uses Google/external Reown wallets; the older restricted local-vault connector does not sign these trades. Sepolia availability, actual wallet approvals and funded public cross-device execution require user verification.

## Cancellation, disputes and liveness

An unaccepted offer can be cancelled by its seller. Acceptance is blocked at expiry; reports are blocked after the payment window. **A timeout does not prove nonpayment.** After acceptance, the seller has no unilateral timeout withdrawal. The buyer can explicitly forfeit their allocation back to the seller, including after a report or dispute.

Either party can flag a dispute. This is a state marker, not an arbitrator or evidence decision. Valid paid evidence can still settle a reported/disputed trade. If evidence is never issued or expires and the buyer does not forfeit, funds can remain locked indefinitely. A dispute before reporting also stops reporting; the buyer can recover by intentionally refunding the seller. This deliberate limitation must be replaced with a reviewed production resolution process before any real asset integration. There is no admin drain, upgrade mechanism, or recovery backdoor.

## Oracle integration prepared, live rates not configured

`GET /api/p2p/quote` is a read-only, `no-store` server endpoint, available in Vercel and the local relay. It fails closed with 503 when unconfigured or verification fails. The page labels its fixed example rate separately. Even a successfully read market reference is **indicative only**; it does not silently replace a funded trade's terms.

Operator-only environment configuration:

```dotenv
P2P_ORACLE_CHAIN_ID=137
P2P_ORACLE_RPC_URL=https://YOUR_POLYGON_RPC
P2P_INR_USD_FEED=REVIEWED_OFFICIAL_INR_USD_FEED_ADDRESS
P2P_USDC_USD_FEED=REVIEWED_OFFICIAL_USDC_USD_FEED_ADDRESS
P2P_INR_MAX_AGE=REVIEWED_FEED_HEARTBEAT_PLUS_MARGIN_SECONDS
P2P_USDC_MAX_AGE=REVIEWED_FEED_HEARTBEAT_PLUS_MARGIN_SECONDS
```

Do not use these placeholders as real configuration. Verify full feed addresses and heartbeats in Chainlink's official catalog before enabling them. This release does not ship guessed addresses. Source chain 137 is a **read-only market-data source**; no Polygon mainnet wallet writes are supported. Check provider terms and operational limits before enabling an external source.

The adapter checks RPC chain ID, exact normalized pair descriptions, feed decimals, positive answers, completed nonzero rounds, non-future/fresh timestamps, a 0.95–1.05 USDC/USD peg band and 50–200 INR/USDC bounds. Conversion divides USDC/USD by INR/USD using integers. Limits are conservative sandbox product bounds, not a general financial oracle specification. Freshness follows operator-reviewed feed heartbeats; INR market closure needs explicit operational policy. Browser references expire automatically and must be refreshed. A price feed does not attest a UPI payment.

## Live proof-provider integration boundary

Peer/ZKP2P's [current Cash documentation](https://github.com/zkp2p/peer-cash) describes UPI/INR cash-out and Amazon Pay buyer payment verification, with Base USDC, supported-provider restrictions and ZKP2P-operated INR oracle feeds. These are not an independent Chainlink DON simply because they use an AggregatorV3 interface. Cash is offramp-only. The legacy `zkp2p-client-sdk` repository is archived; npm SDK 0.14.5 points to a repository that returned 404 during this review. No SDK dependency or opaque mainnet transaction path was added.

Before live integration:

1. Select an available proof-provider corridor and inspect its current supported network, token, verifier deployments, trust model, SDK license/source and access requirements. A provider's “staging” label does not imply testnet. Never trade real INR for gpUSD.
2. Verify authenticated successful payment evidence binding the exact currency/amount, real payee, payer requirements, provider payment identity, trade/payment window and provider finality semantics. A typed UTR, screenshot, matching name or user assertion is insufficient.
3. Derive a **canonical provider nullifier**, not a random browser nonce or user-selected salt. The sandbox's random demo commitments are unsuitable for real payment identity. Plan replay protection across all accepting instances/chains; today's per-escrow map does not provide global uniqueness.
4. Replace the trusted demo attestor with the provider's actual verified-proof mechanism. Do not point this sandbox at real USDC or reinterpret its deployer signatures as bank attestations. A separate reviewed production deployment and explicit chain/token/verifier allowlist are required.
5. Resolve pending, failed, reversed, duplicate, partial, late and disputed transfers, evidence expiry, provider outage and funds-lock recovery. Bank reversals after token settlement remain an off-chain risk. Define a concrete dispute authority/process and liability model; do not promise irreversible INR finality.
6. Complete independent contract review, integration tests against the real provider, operational monitoring and applicable launch review before enabling real settlement. Current tests validate a sandbox, not bank verification or production safety.

## Internal security review

This is a developer review assisted by tests and Slither, **not an independent audit or a security guarantee**.

Compiled with Solidity 0.8.28, optimizer 200, Cancun. Factory/source hash binding:

| Item | Hash |
| --- | --- |
| Source SHA-256 | `565f1d5928c174cb95e86fa8387861c0e6af79c88adef3ed9ea16234321ff34d` |
| Factory creation Keccak-256 | `0xc8440b6b332a38e0b0428f449dab6966f7c679c178543d162e611816a2757789` |
| Factory runtime Keccak-256 | `0x3d6afd57691496b2a61869580efd863cde2ef6bd39900a05f0fc1e664ec2fceb` |

The full unfiltered Slither report is saved in `p2p-slither.json`. GhostPay code: zero High/Medium, four Low timestamp findings, one Informational mixed-pragma finding and three Optimization suggestions. Time comparisons are deliberate acceptance/report/proof boundaries, not a randomness source; block timestamps still have proposer/clock tolerance. Factory fields intentionally remain storage values for an exact runtime comparison; exact creation code separately authenticates initialization.

Dependency-local findings are retained: one High (`incorrect-exp`), ten Medium (`divide-before-multiply`, `unused-return`) and informational notices in pinned OpenZeppelin 5.4. The `Math.mulDiv` XOR is its documented modular-inverse seed; its deliberate division and Newton-Raphson multiplications implement full-precision arithmetic. `Math.invMod` uses the Euclidean algorithm. `SignatureChecker` checks `RecoverError.NoError` and recovered signer; the ignored third result is auxiliary error data. These detector results were reviewed in context, not fixed by changing audited upstream arithmetic. The reproducible script gates new project High/Medium findings and unexpected dependency detector classes; it keeps the complete report and checks the review hashes.

Contract tests cover correct accounting, exact terms acceptance, forged/mutated/cross-domain assertions, caller-independent fixed destinations, replay across trades, timestamp boundaries, disputes, cancellation permissions, mainnet-chain rejection, malformed offers, zero evidence, deflationary deposits and failed-transfer atomic rollback. Mainnet-chain tests run only on isolated simulated networks. Tests do not constitute exhaustive fuzzing, economic analysis or an external audit.
