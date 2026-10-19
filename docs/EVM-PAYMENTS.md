# EVM native-coin payments

## Scope

Testnet-only native coins. Mainnet IDs, Bitcoin, TRON, ERC-20 assets, swaps and bridges are outside this release. The catalog is generated from installed viem chain definitions, with current Sonic testnet 14601 overriding obsolete metadata according to [Sonic documentation](https://docs.soniclabs.com/sonic/build-on-sonic/getting-started). A listed network can have an unavailable public RPC or incompatible EVM behavior; listing it does not establish successful deployment.

## Contract and deployment

`contracts/contracts/GhostPayNativeEscrow.sol` is a single reusable implementation. It is compiled with Solidity 0.8.28, optimizer 200 runs and EVM Paris. It accepts `msg.value`, uses no asset-specific decimals, constructor arguments, immutables, admin or upgrade keys, and therefore has the same runtime bytecode for each deployment. EIP-712 `GhostPay` version `2` uses the runtime chain ID and contract address. Its claim includes payment ID, recipient and deadline. A caller must be the authorized recipient. State changes before the external send and a reentrancy guard blocks reentry; failed transfers roll back state. EOAs require canonical 65-byte low-s signatures; contract senders can validate via ERC-1271. The current browser onboarding is MetaMask EOA-oriented.

A chain cannot reuse another chain's deployed contract instance. In the composer, select a network, preview the amount/rate, connect MetaMask, and choose Deploy escrow. This requires that testnet's gas. Wait for two confirmations and exact runtime/domain validation. An existing v2 address can be imported only after the same checks. Contract addresses are stored on-device, not globally registered. Share a payment URL containing its exact chain and contract; the recipient does not need your deployment storage.

The original Sepolia v1 contract and its bytecode remain unchanged. Its existing links, restricted device wallet and relay still work. Selecting Sepolia uses v1 by default; other network setups deploy v2. No additional public-chain deployment has been performed by the agent.

## Signed links

Requests use typed `ClaimRequest(paymentId,recipient,requestedAt)`. They prove wallet control but never authorize a withdrawal. Sender approvals use `ClaimAuthorization(paymentId,recipient,deadline)` and must be independently checked against the intended person and full wallet. Request/approval envelopes must match the exact chain, contract and payment. Their signatures are verified before approval/claim UI is enabled. URL fragments are shared explicitly and are not sent to the price API or legacy relay.

The UI bounds new approvals to 15 minutes and escrow expiry. The contract itself accepts a valid sender-chosen deadline up to escrow expiry. Approvals cannot be revoked early, and multiple approved wallets create a first-valid-claim race. The first claim/refund consumes the payment. After actual on-chain expiry the sender can refund. Refunds are manual. Everyone can inspect public-chain addresses, balances, amounts and transaction activity.

## Prices

`shared/market.ts` implements fixed-allowlist CoinGecko simple-price retrieval, a separately labeled Coinbase USD exchange-rate fallback, request deduplication and a 45-second in-process cache. `GET /api/prices` is served directly on Vercel, before the old relay route. Local Express exposes the same path. Responses identify provider timestamps versus retrieval timestamps. Conversion rejects quotes older than 180 seconds or more than 60 seconds into the future and rejects invalid/zero rates. No arbitrary upstream URL can be requested by users.

An optional CoinGecko demo key is read only from the server environment. No key is required for keyless providers, which may rate-limit. If all sources fail, the endpoint returns 503 and the user can enter native amounts. USD is a market-reference input for the corresponding mainnet asset; testnet coins have no redeemable USD value. Bigint arithmetic determines the exact native base units and floors the conversion; network gas is additional. The rate/native amount are frozen for the submitted transaction, not guaranteed indefinitely before wallet confirmation.

## Build and checks

- `node scripts/build-networks.mjs`: regenerate public testnet definitions; review upstream metadata changes.
- `npm run build`: compile both contracts, generate the v2 public artifact and bundled market service, then build server and frontend.
- `npm run test --prefix contracts`: isolated contract tests, including v1 regressions, v2 authorization/domain binding, refunds, reentry, transfer rollback, low-s/v checks, ERC-1271 and request-to-claim integration.
- `npm run test:messenger`: model, amount/quote/provider, mainnet-blocking, wallet preparation and encrypted local-wallet tests.
- `npm run sync:vercel`: refresh the production frontend snapshot and market service before Vercel CLI deployment.

The app verifies RPC identity and exact escrow bytecode before transactions, then verifies receipts/events. Known submitted hashes survive retries in the open UI, but are not durable across refreshes. Store transaction hashes and payment URLs separately. Clearing browser storage removes deployment preferences and local history, not on-chain escrows. Public funded two-wallet flows on additional networks remain unverified; automated tests use isolated accounts and mock network failures. This is unaudited hackathon software.


## Reown, direct transfers and community pools

The profile wallet uses Reown AppKit (Google/email/WalletConnect). New payment paths require its connected EVM wallet; the old encrypted device wallet remains limited to original Sepolia payments. `Pay a person` resolves a GhostPay @username through the persistent directory, shows the full address/network/amount, requires a separate confirmation checkbox and resolves the name again before sending. This is an irreversible direct native transfer, not escrow.

`Community fund` deploys/imports `GhostPayCommunity.sol` per testnet. Paste `@username,amount` lines or full EVM addresses; resolve/review every allocation before funding. One campaign supports 1–100 unique wallets, positive allocations summing exactly to the deposit, and a 1-minute–30-day claim window. Claims pay only the calling eligible wallet once. After expiry the organizer may refund only what remains. The title, wallets and allocation amounts are public. No sender approval is needed after funding because eligibility is fixed in the contract. Matrix membership cannot alter it.

The community artifact is `/contracts/community.json`; campaign links include chain, contract, campaign ID and `?deployment=<creation transaction hash>`. No community contract is preconfigured/deployed. The wallet owner must approve deployment and funding with test gas.

## Creation provenance

New v2 escrow funding and all community flows require the successful creation transaction with byte-for-byte trusted init code, matching receipt contract address, canonical block, at least two confirmations, exact current runtime and correct chain/domain. Runtime alone cannot prove safe storage initialization. Import controls require both address and creation hash; links carry the hash so another browser can verify independently. Factory/proxy deployments are unsupported. Older v2 links without creation provenance remain readable for compatibility, but new deposits require the proof. The configured original v1 Sepolia contract and its links remain unchanged.

Pending hashes are held only while the relevant component remains open. Save the transaction hash and funded link; check the chain before retrying after a reload. Direct/campaign history is local browser history, not a durable backend indexer. This release does not sponsor gas, add mainnet, bridge assets, or deploy public community contracts automatically.
