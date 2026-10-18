# GhostPay - current verification state

## EVM native payments - 2026-10-19

- Implemented EVM-native testnet payment selection, USD-reference amount entry, exact integer conversion, source/timestamp disclosure, stale-rate blocking, and native entry fallback. CoinGecko is the primary fixed-allowlist provider; Coinbase is a labeled fallback. Test coins have no redeemable USD value.
- Mainnets, Bitcoin and TRON are excluded. The generated catalog contains 303 EVM testnet definitions, with nine suggested networks. All nine suggested RPC chain IDs were read successfully from this machine using normal request headers. Sonic's obsolete testnet metadata was replaced with official chain ID 14601 after the old endpoint returned a different ID. This does not establish browser CORS support, continuous availability or successful deployments on every network.
- Added one reusable `GhostPayNativeEscrow.sol` v2 implementation compiled for Paris. Each chain needs a separate instance. MetaMask deployment/import validates exact runtime bytecode, RPC chain ID and signing domain. No additional public-chain contract was deployed by the agent; the existing configured Sepolia v1 contract is preserved.
- New v2 payment URLs carry chain/contract/payment ID. Signed request and authorization fragments support relay-independent request -> independent person/wallet verification -> sender approval -> recipient-only on-chain claim. New UI approvals last at most 15 minutes, bounded by escrow expiry. Approvals cannot be revoked early; first valid claim wins. Sender refunds remain available after expiry. No bridges or ERC-20 transfers were added.
- The device wallet retains its original Sepolia escrow whitelist. Other EVM escrow workflows use MetaMask. v2 deployment preferences/history are device-local. Pending hash retries are safe within the open UI, but refresh recovery is not durable.
- Production deployment `dpl_DuLBgx1wPBV91PijW6PU9g2HK4be` is READY at https://ghostpay-lac.vercel.app.
- Public production verification: `/api/prices` returned live CoinGecko quotes for all nine tracked assets and rejected POST with 405. Deployment/health APIs, the native escrow artifact and app deep links returned 200. Mobile USD/native toggles, BNB setup, TRX exclusion, rounded amount controls, desktop spacing and mainnet-link rejection were checked. The original Sepolia `/pay/1` still rendered its claimed on-chain state. No user wallet signing/deployment/funding was performed. Screenshots are `docs/native-payments-mobile.png` and `docs/native-networks-mobile.png`.
- Validation: root production build passed; 47 contract tests passed (22 original plus 25 v2, including ERC-1271, malleable signature rejection and full signed-request-to-claim integration); 19 frontend/messenger/vault test reports passed (including parent suite); 17 server and four gateway regression tests passed. Full funded two-wallet flows on additional public networks remain unverified and require user-controlled funded wallets.

## Messenger UI polish - 2026-10-18

- Removed the top-right local-preview badge and all three app-footer messages. Account/connection controls remain in Settings, and the conversation still discloses that unconnected messages stay on-device.
- Added a lazy-loaded Three.js procedural liquid-light background inside the conversation. Pointer movement distorts the currents; pointer presses emit ripples. A header control pauses/resumes motion. Reduced-motion users receive a static fallback, and offscreen/hidden views stop animation.
- Rounded the composer, search fields, modal fields, and shared payment/setup fields. The badge/footer removals and rendered radii (27px composer, 24px search, 17px form input and 20px amount container) were checked in the deployed DOM.
- Frontend TypeScript/production build passed. Public desktop (1440px) and mobile (390px) layouts and the payment dialog were checked. Consecutive running screenshots differed; consecutive paused screenshots were identical. The browser reported no error/warning logs during these checks. No wallet signing or message transmission was performed.
- Vercel production `dpl_wHqpXmUCGMiEPteew7dicUrFm5pd` is READY at https://ghostpay-lac.vercel.app/chat. Screenshots are stored in `docs/messenger-fluid-desktop.png` and `docs/messenger-fluid-mobile.png`.

## Messenger release - 2026-10-18

- Public messenger: https://ghostpay-lac.vercel.app/chat. Production deployment `dpl_HqDRzyjXwfhTXb23ydPfFVzK7i42` built through the Vercel CLI. Final checks include HTTP 200 for chat/payment/dashboard deep links, deployment/health APIs, JavaScript assets and correctly served Rust crypto WASM. These are availability checks, not live chat/financial lifecycle verification.

- Built `/chat` as a responsive messenger matching the landing page’s monochrome design. Desktop and 390px mobile layouts were visually inspected on the public Vercel deployment. Preview text entry, local persistence, the payment composer, wallet onboarding, settings connection dialog and embedded payment dashboard were exercised without transmitting messages or signing transactions.
- Preview contacts are fictional and local messages are explicitly labeled as not delivered or encrypted. There is no configured Matrix homeserver or Google OAuth provider yet.
- Implemented a real Matrix SDK adapter with Rust crypto, encrypted private rooms/groups, invitations, sync, replies, receipts/typing, bounded authenticated media downloads and encrypted file uploads. Server federation, Google sign-in, actual encrypted delivery and microphone capture are unverified until the server and user configuration are available.
- Added an opt-in device-local self-custodial Ethereum wallet. It uses encrypted JSON storage, explicit confirmations, five-minute idle locking, profile isolation and restricted Sepolia escrow signing. MetaMask remains supported. Wallet backup and its password are required for recovery; Google cannot recover it. This is experimental, unaudited browser wallet code.
- Payment contract and hosted relay remain unchanged. Chat cards reference actual on-chain IDs, and the composer preserves a submitted transaction/funded payment when retrying within the open dialog. A live two-wallet deposit/approval/claim/refund walkthrough has not been performed.
- `npm run build` passed. Existing 22 contract + 17 server + 5 Worker + 4 gateway regression tests passed. The initial Worker attempt lacked its generated bundle; rebuilding the Worker resolved it and all five checks then passed. New messenger/wallet checks pass separately through `npm run test:messenger` (12 reported by Node, including the parent suite). Added a regression for a profile switch during asynchronous decryption; the test exposed a stale record read, which was fixed and rerun successfully.
- Matrix generator smoke checks passed for valid YAML, Google stable-subject mapping, nonprinted generated secrets, refusal to overwrite and nonpublic database/service bindings. Docker is unavailable here, so the prepared Synapse/PostgreSQL/Caddy stack has not been started.
- Calling, background push, full device verification/key-backup setup, native apps and complete WhatsApp parity remain unfinished. See `docs/MESSENGER.md` and `infra/matrix/README.md`.

## Dependency follow-up - 2026-10-18

The root workspace audit initially reported 23 findings (1 high, 22 moderate). The affected nested `viem@2.23.2` transport now resolves `ws@8.21.0` through a scoped override. This uses the [upstream patched version](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), preserving the existing wallet API rather than forcing a major wagmi migration. A fresh root audit reports 21 moderate, zero high and zero critical findings. These counts do not cover the separate hosting dependency trees and do not establish exploitability or absence of other issues. Remaining legacy connector advisories need a controlled dependency migration. No blanket `audit fix --force` was applied.

## Earlier payment deployment record (historical)

## Public hosting

- Vercel production deployment completed through the CLI on 2026-10-17: https://ghostpay-lac.vercel.app. Project `ghostpay`, deployment `dpl_E7uHniAku4JjYvX2tq347793HXHu`, production alias assigned and deployment READY.
- Vercel hosts the frontend snapshot and a Node API gateway to the existing persistent Worker/D1 relay. This preserves requests across both hosted origins; it is not an independent migration of the database to Vercel.
- Fresh frontend build and four gateway tests passed. Unauthenticated live Vercel checks passed for landing page, JS asset/MIME, direct `/pay/1`, `/dashboard`, deployment configuration, live Sepolia health, and shared claim records. Malformed same-origin POST returned 400 from the relay; cross-origin POST was blocked with 403 at the gateway. These checks did not submit a wallet transaction.
- Sepolia chain/code existence was rechecked successfully before this deployment. The contract address remains `0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4`.

- Published successfully on 2026-10-17: https://ghostpay-prem-sepolia.brawnyfrost16.chatgpt.site (public access, no local-machine tunnel).
- Sites project `appgprj_6ad32fd99da88191aaced5bb1f3b6a64`, version 1, deployment `appgdep_6ad331e467708191b64403423ba0137f`, source commit `b4ec85038dc882cfef8725324a75ebc71ceb4273` in the separate `public-site` checkout.
- Verified unauthenticated HTTPS responses: landing page 200, JavaScript bundle 200 with correct MIME, `/pay/1` 200, deployment API 200 with the verified escrow, health API 200 with a live Sepolia head, and request-list API 200 using hosted D1. Invalid claim payload rejected with HTTP 400. These checks do not create a payment or claim funds.
- Sender and recipient must use the public origin for shared request state. The local Express relay is separate; old local request records are not imported. Payment IDs still refer to the same Sepolia escrow.
- Full browser rendering and two-wallet MetaMask walkthrough have not been verified. The browser tab handoff was queued by the app.

## Sepolia migration

- Runtime network is **Ethereum Sepolia (11155111)**. The frontend, wallet switching, relay, EIP-712 domain, network labels, and explorer links use Sepolia.
- Removed local-node startup, unlocked-account funding, local time-travel demo commands, and imported local deployment configuration. Hardhat remains development-only for compiling and isolated security tests.
- Added `/setup`: deploy through MetaMask, estimate deployment gas, wait for two confirmations, verify exact creation bytecode and canonical receipt, and save `deployments/sepolia.json` automatically. The frontend loads this shared configuration from the relay. No backend signing keys or private-key UI are used.
- Deployment registration is idempotent for the same creation transaction and refuses replacing an already configured escrow. A submitted hash can be recovered after refreshing the setup page.
- Verified live Sepolia deployment at `0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4`, creation transaction `0x0c974214ff37b53d2d36a897ef785ea555ac18bd0f301ade5c7b6a6447d91f13`, block `11932903`. Rechecked chain ID, exact compiled creation bytecode, successful creation receipt, canonical block, confirmations, and deployed code on 2026-10-17.

## Validation

- Contract compile and frontend/backend production builds passed during migration.
- Contract security suite: 22 passing tests in an isolated test EVM, not on the running app's network.
- Relay tests: **9 passed**. Deployment-registration unit tests: **8 passed**. Total automated tests: **39 passed** (22 contract + 17 server). Deployment tests use mock RPC responses and do not constitute a public deployment.
- Five additional hosting checks passed against the bundled Worker and an SQLite adapter: durable cross-instance records/deployment isolation, concurrent update protection, deep links/assets/API routing, cross-origin/payload bounds, and recipient signature proof. These supplement the 39 existing contract/server tests. The hosted endpoints and D1 read/rate-limit writes were checked separately after publication.
- Live deployment verification succeeded; a complete two-wallet Sepolia deposit/approval/claim/refund walkthrough still requires manual confirmation.
- Browser visual checks remain blocked by the previously reported saved site permission policy; no alternate browser-control path was used.

## Existing functionality

ETH escrow, wallet-signed claim requests, independently verified EIP-712 sender approval, recipient-only claims, replay protection, expiry/refund, request rejection, and approval renewal. The monochrome interface and live Three.js background remain in place. Public transaction receipts now link to Sepolia Etherscan.

## Important limits

Experimental and unaudited; test ETH only. Local relay request records remain in memory; the hosted Worker uses persistent D1 records and no signing key. Sepolia deployment information is saved on disk and on-chain funds survive relay restarts. Public RPC usage may be rate-limited. The earlier local-node demo report under deployments/ is historical only and is not Sepolia deployment evidence.

See README.md for setup, test commands, security boundaries, and prioritized feature suggestions.
