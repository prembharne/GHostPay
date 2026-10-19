# GhostPay messenger foundation

The messenger keeps the landing page’s black/silver palette, fine borders, editorial serif accents and restrained motion. Conversation backgrounds use a pointer-responsive Three.js liquid-light shader with click ripples and a pause control. This is a procedural visual effect, not a physical fluid simulation. Reduced-motion preferences and WebGL failure retain a static fallback. Input surfaces use rounded borders, and the top preview badge and app footer have been removed. `/chat` uses a dedicated app shell while the landing page and standalone payment URLs remain available.

## What works without configuration

The explicitly labeled local preview supports sending text, creating preview conversations/groups, replying, attaching small files, searching, reading the sample payment card and changing device-local conversation preferences. No remote messages or fictional replies are generated. Preview data is stored in localStorage and is not encrypted. The sample card is unfunded; the actual payment button creates real Sepolia deposits only after wallet confirmation.

The Matrix adapter is separate from preview state. It uses matrix-js-sdk 44, persistent Rust crypto, a browser Web Lock per device, encrypted private rooms, encrypted attachment uploads, authenticated bounded media downloads, receipt/typing events and invitation acceptance. The client refuses sends to unencrypted rooms. Server metadata and blockchain records remain visible to their respective operators/public observers.

## Accounts, wallets and communities

The profile icon opens the wallet panel. Reown AppKit provides Google/email/WalletConnect onboarding and account management. A connected EOA can register one persistent public GhostPay @username using a short-lived personal-sign statement. Names are stored in the shared Worker/D1 directory, not ENS. Private keys are never sent to GhostPay servers. Reown account recovery follows the provider’s supported account/recovery flow; do not confuse it with the legacy device wallet.

Matrix authentication remains separate. A Reown Google wallet session does not authenticate a Matrix account or recover encrypted message keys. Configure Synapse Google OIDC and the public homeserver URL for real chat.

Communities use Matrix Spaces with separate encrypted General and Announcements rooms. Announcements default to administrator-only sending. Users can create child groups, rename groups, invite/remove members and leave, subject to server permissions. Community and child-room memberships are independent. Space names, membership and other state metadata are visible to the homeserver; encrypted messages have separate room keys. The same screens work as explicitly device-local preview until Matrix is connected.

The older optional device wallet still generates a random key locally and stores a password-encrypted Ethereum V3 keystore. Download its backup and keep its password separately. It auto-locks and retains its original Sepolia contract whitelist. It cannot register usernames or use the new multi-network payment paths. Google does not recover that legacy key.

Payment cards cover direct transfer receipts, funded community allocation pools and existing escrow links. Amounts/status come from the selected chain, not message text. Read [identity and communities](IDENTITY-COMMUNITIES.md) for setup, trust boundaries and activation checks.

## Hosting and activation

Vercel serves static app assets and the existing payment relay gateway. Matrix needs its own persistent service. Follow [the homeserver guide](../infra/matrix/README.md) to configure Synapse/PostgreSQL/Caddy with a controlled domain. Docker was unavailable in the development environment, so the stack is prepared but not runtime-tested.

Register the Google callback on the homeserver origin. Supply the public homeserver URL in the connection dialog or `VITE_MATRIX_HOMESERVER`; supply Google credentials only through the private server configuration. The sign-in button is offered only when the server advertises the provider.

Before calling messaging live, verify with two users: Google/password login, encrypted direct/group delivery, invitation review, reconnect, authenticated encrypted file exchange, and a second homeserver. Full verification/key-backup setup UI is still pending; use a trusted Matrix client for setup and verify compatibility. Closing a browser session can require signing in again; encrypted room keys must be backed up for recovery.

## Payments and offline behavior

A recipient may be offline when an online sender funds escrow. A link or signed instruction can wait for connectivity. Ethereum settlement requires someone online to broadcast and confirm a transaction; this app does not implement offline final settlement or Bluetooth mesh.

A failed message send after a successful deposit retains the payment ID in the open composer and offers its standalone URL. Retry sharing that deposit instead of depositing again. If the tab is lost, locate the deposit through My payments/on-chain history. Approval decisions still use the existing persistent relay, independent of Matrix message delivery.

## Remaining product work

- Full cross-signing/device verification, encrypted key backup and recovery UX.
- Username migration/revocation and broader smart-account signature support; the current immutable directory supports EOA proofs.
- Calls with MatrixRTC infrastructure, background push and operational abuse controls.
- Native Android/iOS interfaces and secure OS-backed wallet storage.
- Status updates, advanced group roles, message editing and other WhatsApp parity.
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
