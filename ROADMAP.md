# GhostPay: remaining work and delivery roadmap

Updated: October 25, 2026. Owner: Prem Bharne, Pune, India.

This is a planning document, not a claim that the listed features are implemented. An unchecked item remains open until its acceptance criteria are demonstrated. This document does not deploy contracts, enable real payments, submit credit applications, or implement ZK proofs.

## Product direction

GhostPay helps community organizers agree on work, communicate privately, and pay contributors through wallet-controlled escrow. The proposed differentiator is a connected workflow: encrypted conversation -> mutually approved agreement -> funded milestones -> contributor payout, with optional privacy-preserving eligibility and authenticated payment proofs.

Initial customer: community organizers paying contributors. Focus the hackathon demo on one organizer and one contributor completing that workflow. Fiat P2P is a separate advanced track until authentic payment verification and dispute recovery are ready.

## 1. What exists, and what still needs evidence

| Area | Current implementation boundary | Remaining acceptance evidence |
| --- | --- | --- |
| MST network | Local app targets MST Testnet, chain ID `91562037`, native test coin `tMSTC` | Public deployments and funded two-wallet execution on MST |
| Payment contracts | Escrow, native payment and community contract flows exist | Verify each deployed contract type and demonstrate its supported lifecycle |
| P2P settlement | Mock gpUSD escrow with simulated INR evidence and a trusted deploying-wallet attestor | Authenticated payment evidence, real verifier integration, recovery and independent review |
| Zero-knowledge proofs | No production ZK payment verifier is integrated | Select a narrow claim, implement proof verification and test adversarial cases |
| Messaging | Matrix integration and hosting setup materials exist | Operated homeserver and demonstrated two-account encrypted messaging, recovery and federation behavior |
| Identity | Wallet signatures and username/directory flows exist | Review Matrix-to-wallet binding, rotation and recovery; wallet ownership is not proof of a person's identity |
| Hosting | Earlier public release uses the historical Sepolia service | Durable MST relay, correct frontend/backend configuration and a verified public release |
| Startup materials | Application drafts and public company pages exist | Domain, business email, applicant/account eligibility, current evidence and actual submissions |

Local MST migration checks previously recorded 79 contract tests, 40 frontend tests and 18 relay tests, plus a successful build. These historical results are not a fresh run, a public MST demo, or an independent audit. See [MST migration](docs/MST-MIGRATION.md), [P2P boundaries](docs/P2P-IMPLEMENTATION.md), and [status](STATUS.md).

The current local application changes and this roadmap are separate deliverables. Committing this document alone does not publish or commit the existing application changes.

## 2. Priority 0: make the existing MST MVP demonstrable

- [ ] **Review and commit the existing application changes separately.** Inspect the MST migration, startup pages and generated artifacts; exclude secrets, local state and obsolete build outputs. Record the tested source commit for the eventual release.
- [ ] **Verify MST configuration at release time.** Check the RPC chain ID, wallet add/switch flow, faucet, explorer and native currency labels. Reject wrong-chain RPCs before signing. Never substitute an old Sepolia address for an MST deployment.
- [ ] **Deploy the required contract types using the connected wallet.** Verify exact runtime, creation provenance, canonical successful receipt and required confirmations. Save network-specific deployment records. Use the correct deployment type for v1 escrow, native v2, community and the P2P sandbox.
- [ ] **Complete a funded two-wallet escrow demo.** Organizer creates/funds a link; contributor requests it; organizer independently verifies the recipient and approves; contributor claims. Record actual transaction hashes and final balances. Also demonstrate expiry and manual refund using a separate payment.
- [ ] **Check other advertised flows.** Demonstrate direct transfer and the supported community/native lifecycles on MST if included in the pitch. Omit unverified flows from the live demo claim.
- [ ] **Demonstrate P2P honestly.** Two wallets deploy/use the sandbox, mint worthless gpUSD, fund, accept, report simulated payment, sign the simulated assertion and settle. Show cancellation, disputes and the current funds-lock limitation. Never send real INR for mock tokens.
- [ ] **Finish transaction recovery.** Test reload, navigation, lost RPC, rejected signatures, replaced/cancelled transactions and wallet/network changes. Recover an already-funded payment without a second deposit. Display canonical on-chain state after reconnecting.
- [ ] **Verify history and independent recovery.** Explain any indexing limits; provide contract address, chain and transaction references so users can locate funds when the relay or browser storage is unavailable. Test claim/refund recovery with the available contract methods.
- [ ] **Complete browser QA.** Check desktop/mobile layouts, keyboard navigation, amount precision, loading/error states, wallet switching, external links and installation/offline behavior. Do not mark visual QA complete from compilation alone.

Done when: another person can follow the setup instructions and reproduce the chosen workflow with two wallets on MST Testnet, with verifiable transactions and clearly labeled test assets.

## 3. Priority 0: publish a consistent MST release

- [ ] **Choose a hosting boundary.** Use a separate MST deployment profile or a reviewed full backend cutover. The historical Vercel frontend and its fixed Sepolia relay cannot be assumed compatible with the local MST build.
- [ ] **Provide a durable MST relay.** Implement/configure persistent storage with migrations, unique constraints, concurrent-write protection and restart recovery. Verify identities, approvals, expiry and signatures against the intended chain and contract.
- [ ] **Configure the complete request path.** Check frontend API base, Vercel gateway, relay, RPC, signing domains, origin allowlists, contract records and health endpoints together. Publish only after they agree on MST.
- [ ] **Preserve historical Sepolia access.** Retain original deployment records and recovery instructions for any existing funds. Keep old/new network state isolated. Changing network configuration does not move tokens or escrow deposits.
- [ ] **Add release operations.** Validate backup/restore, RPC failure handling, error monitoring, request limits, storage quotas, secret management, retention and budget alerts. Define who responds when transactions or messaging stop working.
- [ ] **Check generated services and hosted snapshots.** Regenerate from the reviewed source and inspect the output so no mixed MST/Sepolia artifacts ship. Do not publish a frontend alone against the old relay.
- [ ] **Verify the public release from a clean device.** Repeat the selected two-wallet demo using the public URL; record release commit, backend profile, chain, deployment addresses, transaction hashes and known limitations.

Done when: the public frontend and persistent backend support the same verified MST deployment, and the demo survives a service restart.

## 4. Matrix: private messaging and user control

Matrix is federated messaging, not automatically direct device-to-device transport. End-to-end encryption can protect message content, while homeservers still operate accounts, room rules and metadata. Avoid promising that an operator has no control over anything or that all traces can always be deleted.

- [ ] **Operate a homeserver.** Complete the existing Synapse/container setup with a domain, TLS, private database, controlled registration, backups and operational ownership. Verify reverse-proxy and federation configuration when federation is enabled.
- [ ] **Complete account onboarding.** Test two independent Matrix accounts. Explain wallet login versus Matrix login: Reown/Google wallet login does not automatically provide Matrix SSO. Keep server credentials and OIDC secrets off the client.
- [ ] **Verify encrypted conversations.** Demonstrate private chats and encrypted rooms, invites, membership changes, supported media, receipts, reconnect and message history on a second device. Explicitly configure encryption for intended rooms.
- [ ] **Finish device trust and key recovery.** Test device verification/cross-signing, encrypted key backup, recovery after reinstall and clear handling of undecryptable history. Explain what happens if recovery keys are lost.
- [ ] **Bind messaging identity to wallet consent.** Use a signed, scoped challenge that binds Matrix account, wallet, purpose, expiry and replay protection. Test revocation, wallet rotation and account changes. A display name is insufficient payment authorization.
- [ ] **Document moderation and metadata.** Explain operator capabilities, server retention, federation copies and abuse reporting. Keep sensitive payment evidence out of chat logs and analytics. Do not equate encrypted content with anonymous participation.
- [ ] **Verify interoperability.** Test supported external Matrix clients/homeservers and document limits. Measure delivery and recovery behavior before claiming WhatsApp-like reliability.
- [ ] **Schedule later parity features.** Prioritize push notifications, accessibility and reliable attachments after core encryption/recovery. Treat voice/video calls, native mobile apps and large-community scaling as later work unless already demonstrated.

Done when: organizer and contributor can communicate across two accounts/devices, verify device trust and recover their keys using documented steps.

## 5. Product differentiators to build

These are proposals. Shared chat, crypto wallets and private messaging already exist elsewhere; demonstrate the workflow that GhostPay improves rather than claiming to be the first.

### A. Conversation to a jointly approved funded agreement

- [ ] Add a structured agreement containing deliverable, recipient wallet, amount/token, network, deadline, approval rules and cancellation/dispute terms.
- [ ] Make both parties review the same canonical, versioned agreement and explicitly accept before funding or starting work. Bind signatures to the chain, contract, agreement and parties.
- [ ] Store private terms off-chain with an appropriately salted commitment on-chain where needed. Avoid publishing chat text, personal details or guessable unsalted hashes.
- [ ] Display the accepted version alongside funding and payout state. Any material edit requires fresh acceptance; reject stale signatures.

Acceptance example: an organizer discusses a poster in chat, both accept the same deliverable and amount, then the organizer funds its escrow.

### B. Milestone payouts

- [ ] Specify separately funded/allocated milestones, submission, approval, rejection, expiry, partial payout and remaining-funds refund rules.
- [ ] Implement and review the required contract changes; existing all-or-nothing escrow does not become milestone escrow through UI changes alone. Use a new verified deployment/version.
- [ ] Enforce that total releases and refunds never exceed funding, and no milestone can be paid twice. Test approval/refund races and time boundaries.
- [ ] Explain who judges completion and resolves disagreement. A ZK proof cannot establish subjective work quality by itself.

Acceptance example: design and final delivery receive separate approvals and payouts, with the remaining balance always visible.

### C. Community treasury approvals

- [ ] Define a threshold such as two of three organizers, including signer changes, duplicate votes, expiry and emergency procedures.
- [ ] Enforce approvals in a reviewed contract or compatible multisig, binding each approval to exact payout terms. A frontend vote counter or backend key is insufficient.
- [ ] Show contributors the threshold, current approvals and payout authority before they accept work.

Acceptance example: one organizer cannot release a payout requiring two independent approvals.

### D. Private eligibility proof: optional ZK feature

- [ ] Pick one precise claim, such as membership in an approved community without revealing the complete membership list. Define issuer/group trust and revocation.
- [ ] Bind the proof to campaign, recipient and intended action; use scoped nullifiers to prevent duplicate claims without unnecessary cross-campaign tracking.
- [ ] If using ZKEmail, prove a narrowly defined authenticated email claim and document DKIM/issuer assumptions. An email proof does not automatically prove real identity, completed work or bank settlement.
- [ ] Test invalid, expired, revoked and reused credentials. Disclose that recipient wallets and on-chain payouts remain public unless a separate privacy system changes that.

Recommended build order: A, then B; add C when the community workflow needs it. Treat D and real fiat-payment ZK as separate scoped proof projects.

## 6. Real P2P payment proofs and zero knowledge

**Current truth:** the sandbox verifies an EIP-712 assertion from the deploying wallet through a signature check. That is a trusted simulated attestation, not zero-knowledge payment verification. Mock gpUSD is not Circle USDC. No live UPI/bank verification is integrated.

See [P2P implementation](docs/P2P-IMPLEMENTATION.md) and [safety research](docs/P2P-SAFETY-RESEARCH.md) for current limitations. Do not turn the sandbox into a real-money product by changing its token address.

### A. Establish feasibility before implementation

- [ ] Choose one currency, payment method, evidence source and narrow success claim. Inspect the provider's current access requirements, supported environments, verifiers, network/token support, source availability and license.
- [ ] Confirm a usable test environment. A provider calling an environment "staging" does not establish that payments or assets are simulated. Do not exchange real INR for test tokens.
- [ ] Compare authenticated evidence mechanisms, such as a supported zkTLS/payment provider or an appropriately scoped DKIM/ZKEmail flow. Screenshots, typed UTRs, self-authored JSON and a wallet signature alone cannot authenticate bank payment.
- [ ] Confirm MST compatibility independently. Verify the intended proof verifier's opcodes/precompiles, deployment size, gas cost and provider support. General EVM compatibility does not establish that a particular proof integration works.
- [ ] Record a go/no-go decision. If provider access or safe testing is unavailable, keep fiat P2P explicitly simulated and demonstrate another narrow ZK claim separately.

### B. Define exactly what the proof authorizes

- [ ] Bind verified amount, currency, payee and required payer identity to immutable trade terms. Include payment method/provider, authenticated successful status, payment identity and payment time/window.
- [ ] Bind settlement to chain, escrow, trade, terms version and fixed payout recipient. Reject proof reuse for another recipient, order, contract or network; prevent proof-copying/front-running from redirecting tokens.
- [ ] Derive the nullifier from a canonical authenticated payment identity. A random browser nonce is insufficient. Define uniqueness across every accepting contract/chain and implement a shared registry or other sound mechanism if that scope is required.
- [ ] Specify issuer/provider trust, key rotation, revocation, proof freshness and finality assumptions. A receipt can prove an observed status without guaranteeing that a bank transfer will never reverse.
- [ ] Minimize disclosed fields. Define which public inputs, commitments and logs remain linkable; never publish passwords, session tokens, full bank records or unnecessary personal information.

### C. Implement the actual verification boundary

- [ ] Integrate the chosen proof generator and verifier with pinned versions, reproducible artifacts and reviewed verification keys/public inputs. Review circuit constraints and authenticated-data parsing, not just the UI.
- [ ] Make settlement depend on successful verification. If a service verifies off-chain and signs an assertion, document that trust boundary accurately; do not describe a signature-only contract as independently verifying a ZK proof.
- [ ] Use a separately reviewed contract/deployment for the new proof protocol. Restrict supported chains, tokens, providers and verifier versions; define any governance or upgrade authority explicitly.
- [ ] Add proof states: awaiting evidence, generating, verifying, rejected, expired and settled. Failed/rejected proofs must not trigger payout or silently change immutable terms.
- [ ] Protect evidence in transit/storage, redact logs and exclude it from service-worker caches and analytics. Define retention, deletion and recovery rules for any proof material retained.

### D. Resolve disputes, outages and locked funds

- [ ] Define pending, failed, partial, duplicate, late and reversed payment behavior. Specify what happens when the proof provider is down, evidence expires or a payment cannot be proven.
- [ ] Replace the current indefinite-lock limitation with an explicitly reviewed resolution process. Define authority, evidence, deadlines, incentives and the party bearing losses.
- [ ] Prevent the "buyer paid, seller reclaimed on timeout" failure. A timeout alone cannot prove nonpayment. Do not add a unilateral seller sweep to an accepted trade without a sound resolution model.
- [ ] Explain any remaining trust in an attestor, arbitrator, provider or governance key. No admin drain today does not establish complete liveness or safe dispute recovery.
- [ ] Keep real assets disabled until independent security review, provider validation, operational ownership and applicable real-money launch review are complete.

### E. Test the proof protocol adversarially

- [ ] Reject wrong amount/currency/payee/payer, failed status, partial payment, out-of-window payment, invalid issuer, malformed fields, stale proof and invalid cryptographic proof.
- [ ] Reject duplicate payment identities, reused proofs across trades/contracts/chains and altered public inputs, terms, recipient or verifier version.
- [ ] Exercise signature forgery where attestations remain, provider-key rotation, conflicting reports, concurrent settlement, double claim and settlement/refund races.
- [ ] Check randomized/invariant tests: escrow conservation, fixed beneficiaries, exactly-once settlement and bounded authorized withdrawals. Test real provider fixtures with sensitive fields removed.
- [ ] Publish a reproducible testnet demonstration showing the authenticated claim, verifier, resulting transaction, privacy limits and failure/recovery behavior.

Done when: a documented authenticated payment claim is actually checked by the declared verification system before release, replay protection matches its stated scope, and failure/dispute behavior has been demonstrated. This still does not guarantee irreversible fiat settlement or complete anonymity.

## 7. Security and release engineering

- [ ] Review wallet creation, storage, recovery and replacement behavior. Distinguish revoking an app permission from changing an already-funded contract's authorized recipient. Never promise recovery the contract does not support.
- [ ] Verify username assignment and identity-service limitations, including currently permanent assignments/EOA assumptions where applicable. Document supported rotation and avoid treating usernames as independent recipient verification.
- [ ] Keep private keys, recovery phrases, credentials, billing IDs and private proof evidence out of source control and public frontend environment variables.
- [ ] Run applicable build/tests for the exact release source: `npm run build`, `npm test`, `npm run test:messenger`, and Matrix/Worker checks for the components changed. Re-run `check:mst` for network configuration and relevant contract security checks for changed contracts.
- [ ] Refresh dependency/security reports and triage findings against the actual shipped paths. Existing internal Slither/test results are useful evidence but not an independent audit.
- [ ] Review every hosted source tree and generated service actually used in deployment; passing only the local relay tests does not validate a separate Worker implementation.
- [ ] Add meaningful regression coverage for new authorization/proof logic and recovery paths. Define rollback, data migration and historical-contract access before release.
- [ ] Evaluate gas sponsorship only after core correctness. If added, define limits and abuse controls; distinguish sponsored gas from free transfers or guaranteed fee-free operation.

## 8. Hackathon submission and evidence

- [ ] Confirm event rules, submission deadline, team details, required blockchain usage and eligibility. Do not assume using an EVM network meets a particular event's track requirements.
- [ ] Prepare a short registration description: target customer, pain point, demonstrated workflow, MST usage, Matrix role, differentiator and current stage.
- [ ] State implemented versus planned features consistently across README, website, slides and forms. Remove stale Sepolia/test-ETH labels from active MST instructions while preserving historical records accurately.
- [ ] Record a concise two-person demo with readable amounts, network, accepted terms, funding, payout and transaction evidence. Avoid exposing account secrets or private chat/proof material.
- [ ] Provide public demo URL, source commit, setup guide, contract/deployment references, screenshots and known limitations. Keep a fallback recording for wallet/RPC outages.
- [ ] Use precise claims: "Matrix-based encrypted messaging" only for verified encrypted flows; "simulated P2P attestation" until actual proof integration; "MST Testnet MVP" until a different environment is proven.
- [ ] Collect real organizer/contributor feedback and document interview counts, pilot use and outcomes honestly. Goals and planned users are not existing traction.

## 9. Google Cloud and AWS startup-credit preparation

Use [startup-credit materials](docs/startup-credits/README.md) as drafts. Criteria and offers can change; verify the official program requirements when applying. Completion of this roadmap cannot guarantee approval.

- [ ] Obtain a suitable domain and publish accurate product, about, contact, privacy and terms pages. Compare registration and renewal costs. Configure domain email/forwarding deliberately; forwarding alone is not a full sending mailbox.
- [ ] Establish a reliable public contact and domain-based business email where needed. Founder: Prem Bharne; authorized current public email: `prembhrane455@gmail.com`. Do not represent a personal Gmail address as a domain mailbox.
- [ ] Confirm the applicant's real legal/business status and program-specific eligibility. GhostPay started in October 2026 in Pune, India; that is not an incorporation date. Do not invent a company, investor, accelerator affiliation or past credit history.
- [ ] Verify the appropriate Google tier and AWS Activate path against actual funding/affiliation status. Record genuine intent to seek funding separately from funds already raised.
- [ ] Prepare billing accounts and required private identifiers through the providers' own portals. Review payment-method requirements, budgets and post-credit costs before activating services; do not commit billing identifiers or credentials.
- [ ] Explain the infrastructure plan with realistic usage and cost assumptions: frontend/API, persistent data, Matrix hosting/media, monitoring and RPC access. State what credits will fund and why those services are needed.
- [ ] Update application drafts with the current MST release, verified demo evidence and truthful traction. Recheck website/form consistency and the readiness checklist.
- [ ] Submit each application using the founder's actual account and accurate information. Track dates, responses and any requested evidence. Do not claim approval until received.

## 10. Delivery gates and recommended sequence

| Gate | Required outcome | Depends on |
| --- | --- | --- |
| 1: reproducible MST demo | Verified contracts and two-wallet escrow lifecycle with real testnet receipts | Wallets, faucet gas, correct MST configuration |
| 2: reliable public MVP | Durable MST backend, matching public frontend and successful restart/recovery checks | Gate 1, hosting configuration |
| 3: connected organizer workflow | Verified encrypted Matrix chat plus jointly accepted agreement | Matrix operation, identity binding, Gates 1-2 |
| 4: differentiated payout workflow | Reviewed milestone payout and, if needed, threshold organizer approvals | Gate 3, new contract logic and deployments |
| 5: narrow ZK demonstration | A precise verified eligibility or authenticated payment claim, with explicit trust/privacy limits | Feasible provider/circuit, verifier support and adversarial tests |
| 6: real-money P2P consideration | Authentic payment verification, reviewed recovery/disputes, independent security and launch checks | Full P2P proof track; a sandbox demo is insufficient |

Domain/email setup, truthful application drafting and customer interviews can proceed alongside these gates. Do not let an uncertain fiat-proof provider block a focused organizer-to-contributor hackathon demo.

### Final submission checklist

- [ ] Public demo matches the documented source, network and deployments.
- [ ] Two participants can reproduce the selected workflow without developer intervention.
- [ ] Transactions, balances and recovery behavior are demonstrated rather than inferred from UI state.
- [ ] Matrix encryption, device recovery and operator limits are documented accurately.
- [ ] P2P mock assets, attestor trust and any unresolved funds-lock risk are visible.
- [ ] ZK is described as planned unless the declared proof/verifier is actually integrated and demonstrated.
- [ ] Roadmap, implemented features, limitations and evidence agree across submission materials.
- [ ] Startup applications contain accurate founder/business details and no invented traction or eligibility claims.
