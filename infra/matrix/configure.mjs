import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access, chown } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const get = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const server = get('--server');
const app = get('--app') || 'https://ghostpay-lac.vercel.app';
if (!server || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(server)) throw new Error('Pass --server matrix.your-domain.com. Use a hostname you control.');
const appUrl = new URL(app);
if (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.username || appUrl.password || appUrl.search || appUrl.hash) throw new Error('--app must be a public HTTPS origin.');
const configPath = resolve(root, 'generated/homeserver.yaml');
const callerUid = typeof process.getuid === 'function' ? process.getuid() : 991;
const callerGid = typeof process.getgid === 'function' ? process.getgid() : 991;
const matrixUid = callerUid === 0 ? 991 : callerUid;
const matrixGid = callerUid === 0 ? 991 : callerGid;
for (const path of [configPath, resolve(root, '.env')]) {
  try { await access(path); throw new Error('Configuration already exists. Back it up and edit it deliberately instead of regenerating server secrets.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const secret = () => randomBytes(36).toString('hex'); const databasePassword = secret();
const q = value => JSON.stringify(value);
let config = `server_name: ${q(server)}
public_baseurl: ${q(`https://${server}/`)}
pid_file: /data/homeserver.pid
web_client_location: ${q(appUrl.origin + '/chat')}
report_stats: false
enable_registration: false
enable_registration_without_verification: false
enable_media_repo: true
max_upload_size: 16M
media_store_path: /data/media_store
signing_key_path: /data/server.signing.key
log_config: /data/log.config
macaroon_secret_key: ${q(secret())}
form_secret: ${q(secret())}
registration_shared_secret: ${q(secret())}
listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    bind_addresses: ['0.0.0.0']
    resources:
      - names: [client, federation]
        compress: false
database:
  name: psycopg2
  args:
    user: synapse
    password: ${q(databasePassword)}
    database: synapse
    host: postgres
    port: 5432
    cp_min: 5
    cp_max: 10
trusted_key_servers:
  - server_name: matrix.org
sso:
  client_whitelist:
    - ${q(appUrl.origin + '/')}
`;
if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error('Provide both Google OAuth values in this shell, or neither.');
  config += `oidc_providers:
  - idp_id: google
    idp_name: Google
    idp_brand: google
    issuer: https://accounts.google.com/
    client_id: ${q(process.env.GOOGLE_CLIENT_ID)}
    client_secret: ${q(process.env.GOOGLE_CLIENT_SECRET)}
    scopes: [openid, profile, email]
    user_mapping_provider:
      config:
        subject_claim: sub
        localpart_template: '{{ user.given_name|lower }}'
        display_name_template: '{{ user.name }}'
        email_template: '{{ user.email }}'
`;
}
await mkdir(resolve(root, 'generated'), { recursive: true });
await writeFile(configPath, config, { mode: 0o600, flag: 'wx' });
if (callerUid === 0 && process.platform !== 'win32') await chown(configPath, matrixUid, matrixGid);
await writeFile(resolve(root, '.env'), `MATRIX_SERVER_NAME=${server}\nPOSTGRES_PASSWORD=${databasePassword}\nMATRIX_UID=${matrixUid}\nMATRIX_GID=${matrixGid}\n`, { mode: 0o600, flag: 'wx' });
console.log('Created private Matrix configuration. No secrets were printed. Keep generated/ and .env out of Git.');
console.log(`Google callback to register: https://${server}/_synapse/client/oidc/callback`);
console.log('Point the hostname at your server, then run docker compose up -d from this directory.');
