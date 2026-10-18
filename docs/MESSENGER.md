# GhostPay messenger foundation

The messenger keeps the landing page’s black/silver palette, fine borders, editorial serif accents and restrained motion. `/chat` uses a dedicated app shell while the landing page and standalone payment URLs remain available.

## What works without configuration

The explicitly labeled local preview supports sending text, creating preview conversations/groups, replying, attaching small files, searching, reading the sample payment card and changing device-local conversation preferences. No remote messages or fictional replies are generated. Preview data is stored in localStorage and is not encrypted. The sample card is unfunded; the actual payment button creates real Sepolia deposits only after wallet confirmation.

The Matrix adapter is separate from preview state. It uses matrix-js-sdk 44, persistent Rust crypto, a browser Web Lock per device, encrypted private rooms, encrypted attachment uploads, authenticated bounded media downloads, receipt/typing events and invitation acceptance. The client refuses sends to unencrypted rooms. Server metadata and blockchain records remain visible to their respective operators/public observers.

## Account and wallet flow

1. Connect a Matrix homeserver and use its advertised Google OIDC or password login. Google OIDC is verified by Synapse; no Google client secret belongs in a browser bundle.
2. Opt into a local wallet or connect MetaMask. Creating the local wallet requires a separate user-chosen password. Automatic Google-only wallet recovery is not implemented.
3. A random Ethereum key is generated on-device and saved only as a password-encrypted Ethereum V3 keystore. The decrypted key remains in memory while unlocked. It is never sent to the relay or homeserver.
4. Download the encrypted backup. Store its password separately. Device/profile changes lock the wallet; five minutes without a wallet operation also locks it. Losing both browser data and the backup loses wallet access.
5. Create a test-ETH escrow link from the chat composer. The card contains only version, chain, contract and payment ID. Amount/status are read from the configured contract, not trusted message text.
6. The recipient requests, the sender independently verifies the exact wallet, and the existing contract requires sender authorization before a claim. A Matrix display name alone is not a verified wallet identity.

The device wallet exposes only GhostPay signing operations and the configured Sepolia escrow methods. Every signature and transaction requires an explicit confirmation. It does not sponsor gas, sign arbitrary dapp messages, deploy contracts or support mainnet. Use MetaMask for the existing deployment screen.

An XSS or compromised frontend can still compromise a key while unlocked. This wallet is experimental, unaudited and intended for test ETH only. It is not a passkey/MPC/smart-account recovery implementation.

## Hosting and activation

Vercel serves static app assets and the existing payment relay gateway. Matrix needs its own persistent service. Follow [the homeserver guide](../infra/matrix/README.md) to configure Synapse/PostgreSQL/Caddy with a controlled domain. Docker was unavailable in the development environment, so the stack is prepared but not runtime-tested.

Register the Google callback on the homeserver origin. Supply the public homeserver URL in the connection dialog or `VITE_MATRIX_HOMESERVER`; supply Google credentials only through the private server configuration. The sign-in button is offered only when the server advertises the provider.

Before calling messaging live, verify with two users: Google/password login, encrypted direct/group delivery, invitation review, reconnect, authenticated encrypted file exchange, and a second homeserver. Full verification/key-backup setup UI is still pending; use a trusted Matrix client for setup and verify compatibility. Closing a browser session can require signing in again; encrypted room keys must be backed up for recovery.

## Payments and offline behavior

A recipient may be offline when an online sender funds escrow. A link or signed instruction can wait for connectivity. Ethereum settlement requires someone online to broadcast and confirm a transaction; this app does not implement offline final settlement or Bluetooth mesh.

A failed message send after a successful deposit retains the payment ID in the open composer and offers its standalone URL. Retry sharing that deposit instead of depositing again. If the tab is lost, locate the deposit through My payments/on-chain history. Approval decisions still use the existing persistent relay, independent of Matrix message delivery.

## Remaining product work

- Full cross-signing/device verification, encrypted key backup and recovery UX.
- Secure wallet/account linking with signed challenges and conflict/revocation handling.
- Calls with MatrixRTC infrastructure, background push and operational abuse controls.
- Native Android/iOS interfaces and secure OS-backed wallet storage.
- Status updates, advanced group administration, message editing and other WhatsApp parity.
- Independent security review and live multi-device/payment lifecycle testing before production.

## Verification commands

```sh
npm run build
npm test
npm run test:messenger
npm run build --prefix public-site
npm test --prefix public-site
npm test --prefix vercel-site
```

The automated wallet tests generate ephemeral test keys and verify encrypted storage, explicit confirmation, domain restrictions, cancellation, locking, import and account isolation. They do not submit public transactions or prove live Matrix federation. Browser checks cover the deployed desktop/mobile preview, local persistence, wallet dialog and payment composer; microphone access and financial signing are left to the user.
