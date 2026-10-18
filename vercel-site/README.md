# GhostPay on Vercel

Production: https://ghostpay-lac.vercel.app

Sepolia escrow: `0x3F5632eDFcbF22D7CFF126106854a6700Ffd7bF4` (chain ID `11155111`).

This sanitized deployment directory contains a production frontend snapshot and a Vercel Node API gateway. The gateway forwards only GhostPay API routes to the existing persistent Sites/Cloudflare relay. Both public origins share request records and the same verified Sepolia escrow. No signing key is used or bundled.

Refresh the frontend before publishing from PowerShell:

```powershell
cd D:\hackathon\ghostpay-github
npm run build -w frontend
npm run sync:vercel
cd vercel-site
npm test
vercel deploy --prod --yes
```

Preserve `.vercel/project.json` locally to target the same Vercel project on future deployments. It is ignored by Git. No local relay, `.env`, logs, or development keys belong in this directory.

The API validates POST Origin at the Vercel boundary, limits JSON payload size, uses a fixed upstream, and forwards wallet signatures unchanged. The upstream independently verifies signatures and on-chain state. Upstream per-IP rate limits apply to Vercel egress addresses collectively; large-scale usage requires dedicated gateway-aware quotas. Relay availability still depends on the existing hosted service.

The messenger is served at `/chat`. Its Rust encryption WASM is a static asset and must retain `application/wasm` MIME. Vercel does not host Synapse or Google OAuth secrets; see `../infra/matrix/README.md`.
