import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { config, configureDeployment, setDeploymentIssue } from './config/web3';
import App from './App';
import './style.css';
import './workspace.css';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } });
async function bootstrap() {
  try {
    const response = await fetch('/api/deployment', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('Start or restart the Sepolia relay with npm start.');
    configureDeployment(await response.json());
  } catch (error) { setDeploymentIssue((error as Error).message || 'The Sepolia relay is unavailable.'); }
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><WagmiProvider config={config}><QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></WagmiProvider></React.StrictMode>);
}
void bootstrap();
