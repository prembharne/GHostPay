import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { buildPwa } from './pwa/build';
export default defineConfig({ plugins: [react(), tailwindcss(), { name: 'ghostpay-public-shell', apply: 'build', closeBundle: () => buildPwa(fileURLToPath(new URL('./dist', import.meta.url))) }], build: { manifest: true }, server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } } });
