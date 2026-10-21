import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { config, configureDeployment, setDeploymentIssue } from './config/web3';
import App from './App';
import { initReown } from './config/reown';
import { PwaProvider } from './pwa/PwaProvider';
import { AppErrorBoundary } from './components/AppLoading';
import './style.css';
import './workspace.css';
import './messenger/mobile-polish.css';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
const root = ReactDOM.createRoot(document.getElementById('root')!);
const render = () => root.render(<React.StrictMode><WagmiProvider config={config}><QueryClientProvider client={queryClient}><BrowserRouter><PwaProvider><AppErrorBoundary><App/></AppErrorBoundary></PwaProvider></BrowserRouter></QueryClientProvider></WagmiProvider></React.StrictMode>);
async function bootstrap() {
  try { if (navigator.onLine) initReown(); } catch { console.warn('Wallet provider initialization failed. Retry from your profile.'); }
  // Messaging and the public landing page do not depend on the legacy escrow relay.
  if (window.location.pathname === '/' || window.location.pathname.startsWith('/chat')) render();
  try {
    const response = await fetch('/api/deployment', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('Start or restart the Sepolia relay with npm start.');
    configureDeployment(await response.json());
  } catch (error) { setDeploymentIssue((error as Error).message || 'The Sepolia relay is unavailable.'); }
  render();
}
void bootstrap();
