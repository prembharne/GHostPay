# GhostPay — current verification state

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
