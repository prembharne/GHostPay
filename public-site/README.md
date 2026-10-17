# GhostPay public Sepolia deployment

Public URL: https://ghostpay-prem-sepolia.brawnyfrost16.chatgpt.site

This checkout hosts the existing React application and a same-origin, wallet-signature-authenticated claim relay on Sites. The relay uses D1 so claim requests survive Worker restarts and remain visible across devices. Escrow funds remain on Ethereum Sepolia; this service holds no signing key and cannot move funds.

The verified, immutable deployment is in `deployment.json`. Deployment replacement is disabled on the public endpoint. Both sender and recipient must use this public origin to share the same relay. Existing `/pay/<id>` paths can be opened on this origin; signatures stored only in the old local relay are not automatically imported.

`frontend-dist/` is a sanitized production snapshot built from the main GhostPay Vite app. Refresh it after frontend changes. `shared/` mirrors the main app's ABI, message protocol, and network constants. No environment files, wallet keys, logs, or local relay records are included.

Run `npm ci`, `npm run db:generate` after schema changes, `npm run build`, `npm test`, and `npm run validate`. Commit generated Drizzle migrations and metadata. Sites applies schema migrations when publishing; runtime code never creates tables.

The build bundles the relay and embeds static assets in one Worker ESM file. Publish with the Sites source-workflow helper, then save and deploy the matching version. Hosting configuration is in `.openai/hosting.json`.

Use Sepolia test ETH only. Experimental, unaudited hackathon software. Full MetaMask two-wallet flow requires manual testing.
