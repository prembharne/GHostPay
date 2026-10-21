import { Component, type ReactNode } from 'react';
import { ArrowRight, Ghost, RefreshCw } from 'lucide-react';
export function AppLoading({ label = 'Opening your conversations' }: { label?: string }) {
  return <div className="gp-app-opening" role="status" aria-label={label}><div><span className="gp-opening-brand"><Ghost size={25}/><strong>Ghost<span>Pay</span></strong></span><p>A little closer.</p><div className="gp-opening-skeleton" aria-hidden="true"><i/><section>{[1, 2, 3].map(n => <div key={n}><b/><span><i/><i/></span></div>)}</section></div><small>{label}…</small></div></div>;
}
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="gp-app-opening gp-app-error" role="alert"><div><Ghost size={40}/><p>Let’s get you<br/>back to your people.</p><span>This screen couldn’t finish loading. Check your connection, then reload GhostPay. Save any unfinished payment details first.</span><button onClick={() => window.location.reload()}><RefreshCw size={17}/>Reload app</button><a href="/chat">Open messenger<ArrowRight size={16}/></a></div></div> : this.props.children;
  }
}
