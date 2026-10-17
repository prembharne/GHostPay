import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useBalance, usePublicClient, useSendTransaction, useSwitchChain } from 'wagmi';
import { formatEther, type Hex } from 'viem';
import { ArrowUpRight, Check, ExternalLink, Rocket, ShieldCheck } from 'lucide-react';
import { chain, contractAddress, deployed, explorer } from '../config/web3';
import { api } from '../lib/api';
import { useAction } from '../hooks/useAction';
import { Busy, Feedback } from '../components/UI';

const pendingKey = 'ghostpay-sepolia-deployment-transaction';
function savedHash(): string { try { return sessionStorage.getItem(pendingKey) || ''; } catch { return ''; } }

export function Setup() {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: chain.id });
  const { data: balance } = useBalance({ address, chainId: chain.id, query: { refetchInterval: 15000 } });
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const action = useAction();
  const [hash, setHash] = useState(savedHash);
  const [existingHash, setExistingHash] = useState('');
  const artifact = useQuery({ queryKey: ['sepolia-artifact'], queryFn: () => api<{ bytecode: Hex; chainId: number }>('/deployment/artifact'), enabled: !deployed });
  const cost = useQuery({
    queryKey: ['deployment-estimate', address, artifact.data?.bytecode],
    enabled: !!address && !!client && !!artifact.data && !deployed && chainId === chain.id,
    staleTime: 30000,
    queryFn: async () => {
      const gas = await client!.estimateGas({ account: address!, data: artifact.data!.bytecode });
      const price = await client!.getGasPrice(); return gas * price * 120n / 100n;
    },
  });
  async function finish(transactionHash: Hex) {
    action.setNotice('Waiting for two Sepolia confirmations. Keep this tab open…');
    const receipt = await client!.waitForTransactionReceipt({ hash: transactionHash, confirmations: 2, timeout: 240000 });
    if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('This transaction did not successfully deploy a contract. No deployment was registered.');
    action.setNotice('Contract confirmed. Checking the creation bytecode and saving the Sepolia address…');
    await api('/deployment', { transactionHash: receipt.transactionHash });
    try { sessionStorage.removeItem(pendingKey); } catch { /* Storage is optional. */ }
    window.location.assign('/dashboard');
  }
  async function deploy() {
    await action.run(async () => {
      if (!address || chainId !== chain.id || !client || !artifact.data) throw new Error('Connect MetaMask to Sepolia first.');
      if (artifact.data.chainId !== chain.id) throw new Error('Deployment artifact is not configured for Sepolia.');
      const current = await api<{ configured: boolean }>('/deployment');
      if (current.configured) { window.location.reload(); return; }
      if (!balance?.value || (cost.data && balance.value < cost.data)) throw new Error('Your Sepolia wallet needs more test ETH to pay deployment gas. Use a Sepolia faucet.');
      action.setNotice('Confirm the contract deployment transaction in MetaMask. It sends no payment deposit.');
      const transactionHash = await sendTransactionAsync({ data: artifact.data.bytecode, value: 0n, chainId: chain.id });
      setHash(transactionHash);
      try { sessionStorage.setItem(pendingKey, transactionHash); } catch { /* The hash remains visible below. */ }
      await finish(transactionHash);
    });
  }
  return <div className="page setup-page">
    <div className="page-heading"><span className="section-kicker">ETHEREUM SEPOLIA · 11155111</span><h1>One deployment.<br/>Ready for <em>real testnet payments.</em></h1><p>Deploy GhostPayEscrow using your MetaMask wallet. Your private key stays in your wallet.</p></div>
    {deployed ? <section className="panel form-panel"><span className="step-icon"><Check size={22} /></span><h2 className="setup-title">GhostPay is deployed on Sepolia.</h2><p className="setup-copy">This app is connected to the following on-chain escrow.</p><a className="setup-address" href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">{contractAddress}<ExternalLink size={15} /></a><div className="button-row"><Link className="button primary" to="/create">Create a payment<ArrowUpRight size={16} /></Link><Link className="button secondary" to="/dashboard">My payments</Link></div></section> : <div className="create-layout">
      <section className="panel form-panel">
        <div className="panel-title"><span className="step-icon"><Rocket size={20} /></span><div><h2>Deploy GhostPayEscrow</h2><p>Sepolia only. No mainnet deployment.</p></div></div>
        <dl className="payment-details"><div><dt>Network</dt><dd>Ethereum Sepolia</dd></div><div><dt>Wallet balance</dt><dd>{balance ? `${Number(formatEther(balance.value)).toFixed(6)} Sepolia ETH` : 'Connect your wallet'}</dd></div><div><dt>Estimated gas budget</dt><dd>{cost.data ? `~${Number(formatEther(cost.data)).toFixed(6)} ETH` : cost.isFetching ? 'Estimating…' : 'Shown after connecting'}</dd></div><div><dt>Payment deposit</dt><dd>0 ETH — deployment only</dd></div></dl>
        {!address && <div className="feedback neutral">Connect MetaMask using the wallet button above. Fund that address with Sepolia test ETH.</div>}
        {address && chainId !== chain.id && <button className="button secondary full" onClick={() => action.run(async () => { await switchChainAsync({ chainId: chain.id }); })}>Switch to Ethereum Sepolia</button>}
        {cost.error && <p className="feedback error">Gas estimation failed. Check your RPC connection and wallet balance before deploying.</p>}
        {artifact.error && <p className="feedback error">Deployment artifact unavailable. Restart the project with npm start to compile and launch the Sepolia relay.</p>}
        <Feedback action={action} />
        {hash ? <><a className="setup-address" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">View deployment transaction<ExternalLink size={15} /></a><button className="button primary full" disabled={action.busy || !client} onClick={() => action.run(() => finish(hash as Hex))}>{action.busy ? <Busy>Confirming deployment…</Busy> : 'Finish setup from this transaction'}</button><button className="text-button" disabled={action.busy} onClick={() => { setHash(''); try { sessionStorage.removeItem(pendingKey); } catch {} }}>Clear saved transaction reference</button></> : <button className="button primary full" onClick={deploy} disabled={action.busy || !address || chainId !== chain.id || !artifact.data || cost.isFetching}>{action.busy ? <Busy>Deploying…</Busy> : <>Deploy on Sepolia<ArrowUpRight size={17} /></>}</button>}
        <p className="form-footnote">MetaMask shows the final gas fee before you confirm.</p>
        <details className="setup-import"><summary>Already deployed from another tab or CLI?</summary><label htmlFor="deployment-hash">Sepolia creation transaction hash</label><input id="deployment-hash" value={existingHash} onChange={e => setExistingHash(e.target.value.trim())} placeholder="0x…" autoComplete="off" /><button className="button secondary" disabled={action.busy || !/^0x[\da-fA-F]{64}$/.test(existingHash)} onClick={() => action.run(() => finish(existingHash as Hex))}>Verify & register contract</button></details>
      </section>
      <aside className="create-aside"><span className="step-icon"><ShieldCheck size={22} /></span><h2 className="setup-title">Your wallet.<br/><span>Your signature.</span></h2><p>No seed phrases, private keys, or backend signing keys are required.</p><ol className="vertical-steps"><li><span>1</span><div><strong>Get Sepolia test ETH</strong><p>Use a faucet with your connected wallet address. Test ETH pays network gas.</p></div></li><li><span>2</span><div><strong>Confirm in MetaMask</strong><p>A single transaction creates the non-upgradeable escrow. Your wallet shows the gas fee.</p></div></li><li><span>3</span><div><strong>Wait for two confirmations</strong><p>The relay verifies the deployment bytecode and saves the contract address automatically.</p></div></li></ol><a className="button secondary" href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noreferrer">Get Sepolia test ETH<ExternalLink size={15} /></a><div className="aside-note setup-note"><ShieldCheck size={18} /><p>Experimental, unaudited software. Use Sepolia test ETH only. Testnet balances are separate from mainnet balances.</p></div></aside>
    </div>}
  </div>;
}
