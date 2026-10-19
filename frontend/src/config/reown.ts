import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { http, injected } from 'wagmi';
import { evmTestnets } from '../../../shared/evm-networks';
import { chainFor } from '../../../shared/nativeProtocol';
import { ghostWallet } from '../wallet/connector';
// Public project identifier supplied by the project owner. Never a signing secret.
export const reownProjectId = import.meta.env.VITE_REOWN_PROJECT_ID || '3f139c3090412322bc70d9d894dadb38';
const networks = evmTestnets.map(chainFor) as [ReturnType<typeof chainFor>, ...ReturnType<typeof chainFor>[]];
export const walletAdapter = new WagmiAdapter({ projectId: reownProjectId, networks, connectors: [injected({ target: 'metaMask' }), ghostWallet()], transports: Object.fromEntries(evmTestnets.map(n => [n.id, http(n.rpc, { timeout: 20000, retryCount: 1 })])) });
export const walletConfig = walletAdapter.wagmiConfig;
let kit: ReturnType<typeof createAppKit> | undefined;
export function initReown() {
  if (kit) return kit;
  const origin = window.location.origin;
  kit = createAppKit({ adapters: [walletAdapter], projectId: reownProjectId, networks, defaultNetwork: networks[0],
    metadata: { name: 'GhostPay', description: 'Conversations and community payments. Your wallet, your control.', url: origin, icons: [`${origin}/ghost.svg`] },
    themeMode: 'dark', themeVariables: { '--w3m-accent': '#d5d5da', '--w3m-border-radius-master': '3px', '--w3m-font-family': 'Inter, sans-serif' },
    allowUnsupportedChain: false, defaultAccountTypes: { eip155: 'eoa' },
    features: { socials: ['google'], email: true, analytics: false, swaps: false, onramp: false, send: false, history: false },
  });
  return kit;
}
export async function openWalletAccount(view?: 'Connect' | 'Account') {
  const modal = initReown();
  // AppKit renders outside native dialogs. Suspend their top layer without unmounting forms.
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
  for (const dialog of dialogs) dialog.close();
  const restore = () => { for (const dialog of dialogs) if (dialog.isConnected && !dialog.open) dialog.showModal(); };
  try {
    await modal.open({ view: view || (modal.getAccount('eip155')?.isConnected ? 'Account' : 'Connect') });
    await new Promise<void>(resolve => {
      let unsubscribe: (() => void) | undefined;
      const check = (state: { open: boolean }) => { if (!state.open) { unsubscribe?.(); restore(); resolve(); } };
      unsubscribe = modal.subscribeState(check);
      if (!modal.getState().open) { unsubscribe(); restore(); resolve(); }
    });
  } catch (error) { restore(); throw error; }
}
