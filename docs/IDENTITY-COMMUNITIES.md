# Wallet identity and community payments

## Activation

1. Open the profile icon or My wallet. The public Reown Project ID is `3f139c3090412322bc70d9d894dadb38`; an optional `VITE_REOWN_PROJECT_ID` replaces it. Allow the production origin `https://ghostpay-lac.vercel.app` in the Reown Dashboard. This ID is browser-visible and is not an OAuth secret.
2. Choose Google/email or an external wallet in Reown. Complete the provider’s login yourself. GhostPay requests an EOA and keeps unsupported/mainnet payment paths disabled. It does not store a server-side wallet key. Google wallet login is separate from Matrix chat login.
3. Choose a unique @username, or let the service assign `ghost_<random suffix>`. Sign the explicit public wallet-binding statement. Usernames are case-insensitive ASCII, 3–24 characters, start with a letter, and allow letters/numbers/underscore. Reserved service names cannot be registered. One wallet has one immutable username; renaming/reassignment is not implemented.
4. For live groups, configure the Matrix homeserver using [the server guide](../infra/matrix/README.md). Create a community, invite its members, and invite each person to relevant child groups separately. General and administrator-only Announcements are created automatically. Local preview performs these actions only on this browser.
5. Open Pay in a group to prepare a community pool. Deploy the contract once on that testnet or import its address plus creation hash. Resolve all eligibility rows, verify addresses/amounts, then approve the testnet transaction in your wallet. Each eligible wallet opens the same link and claims its allocation before expiry. Members need gas; no automatic gas sponsorship exists.

## Directory protocol and trust

Profiles are stored in the existing hosted Worker/D1 service, accessed through the Vercel gateway. `GET /api/profiles/name/:username`, `/address/:wallet` and `/search/:prefix` are public reads; `POST /api/profiles/resolve` is a bounded read-only bulk lookup (1–100 names). `POST /api/profiles` requires a 65-byte EOA signature over the strict GhostPay registration statement, normalized username/automatic marker, wallet, application domain, 32-hex nonce and issued-at time within five minutes. The service recovers and compares the signer. Database uniqueness protects competing registrations. It stores wallet, username and creation time only, not email/private keys.

This is a central application directory, not ENS and not decentralized ownership of a name. A wallet proof proves control of a key, not identity or safety of the person. The operator, frontend, wallet provider, RPCs and hosting remain trust dependencies. Username resolution is rechecked before direct transfer, but a compromised directory can still provide a malicious destination. Verify first-time recipients independently. EOA proofs are supported; ERC-1271 profile registration is not yet supported.

## Contract guarantees and limits

`GhostPayCommunity` has no administrator withdrawal, upgrade or protocol fee. Immutable wallet allocations, checks-effects-interactions and a reentrancy guard enforce one claim per eligible caller. The organizer cannot claw back an active allocation before expiry. Unclaimed funds are manually refundable after expiry. Public titles, wallets and amounts are not private. Joining or leaving a chat community has no effect on funded eligibility. One source is reused across EVM testnets, with separate deployments and liquidity per chain.

Automated tests include 50 recipients, duplicate/invalid lists, exact funding, repeated/outsider claims, expiry, partial refunds, failed sends and reentrancy. These are isolated tests, not a security audit. Actual Google account authorization, public funded direct/community lifecycles and live Matrix cross-device delivery still require user-operated verification. No new public-chain contract was deployed by the agent.
