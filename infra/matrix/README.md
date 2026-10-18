# GhostPay Matrix homeserver

Prepared server configuration for the messenger. This is not deployed yet. It requires a Linux host with Docker Compose, a public domain pointing to that host, open HTTPS ports, persistent storage, and backups. The current development machine has no Docker runtime, so this stack has not been started or federation-tested here.

## Configure

Use a hostname you control. Its `server_name` becomes part of Matrix user IDs and should not change after accounts are created.

```sh
node configure.mjs --server matrix.example.com --app https://ghostpay-lac.vercel.app
docker compose up -d
```

The script generates private server and database secrets into ignored files. It refuses to overwrite an existing configuration. Back up these files, database, media, and signing key; never publish them.

Synapse is pinned to `v1.163.0`, the release checked when this setup was prepared. PostgreSQL and Caddy use maintained major-version image tags. Review versions, image digests, resource sizing, and upstream security updates before production operation.

## Google sign-in

Provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the configuration process's environment before the first setup. Do not paste secrets into the frontend, GitHub, or browser-prefixed settings.

Register this exact OAuth callback with Google:

```text
https://matrix.example.com/_synapse/client/oidc/callback
```

Synapse verifies Google through its standard OIDC flow and binds the account using the stable subject claim. The suggested username comes from the given name; Synapse handles account mapping/collisions and may show an account setup screen. Google authentication does not create, unlock, recover, or authorize an Ethereum wallet. GhostPay creates a separate password-encrypted wallet on the user's device when they opt in.

For existing configuration, deliberately add the provider using the [Synapse OIDC documentation](https://element-hq.github.io/synapse/latest/openid.html) rather than rerunning the generator. The client discovers the server's actual login flows and only offers Google when the server advertises it.

## First test accounts without Google

Public password registration is disabled. An administrator can create test accounts interactively:

```sh
docker compose exec synapse register_new_matrix_user -c /data/homeserver.yaml http://localhost:8008
```

Enter passwords interactively; keep them out of shell history and repository files.

## Connect GhostPay

Open the messenger's connection dialog and enter `https://matrix.example.com`, or set public `VITE_MATRIX_HOMESERVER` in `frontend/.env.local` and rebuild. Sign in using a configured Matrix account or the advertised Google provider.

The app enables SDK Rust encryption and creates encrypted private rooms. It does not automatically accept invitations. Message/attachment encryption and multi-tab device storage protection are implemented; the complete cross-device verification and key-backup setup UI remains future work. Use a trusted Matrix client to set up verification/recovery until that interface is implemented, and test compatibility rather than assuming it.

## Verification before announcing live messaging

Check authenticated login, encrypted direct messages and groups, reconnect behavior, media uploads/downloads, and a second independently operated homeserver. Verify wallet approval separately. Google sign-in, federation, E2EE delivery, and multi-device recovery are not verified by a static frontend deployment.

## Calls and mobile

This stack intentionally contains no calling service yet. MatrixRTC/Element Call needs a separate LiveKit SFU/authorization service and network traversal setup. The website currently labels calling as unavailable. Android and iOS clients can later use the same Matrix network with their own secure device setup.

## Operations

Do not expose PostgreSQL publicly. Keep database, media and Caddy volumes persistent. Test restoration from encrypted backups, enforce storage quotas, monitor federation and upload traffic, and review abuse controls before allowing public signup. A federated server is still an availability dependency for its own users; it does not hide all metadata.
