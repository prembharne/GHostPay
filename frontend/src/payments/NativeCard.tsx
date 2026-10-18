import { Link } from 'react-router-dom';
import { formatUnits } from 'viem';
import { ArrowUpRight, Ghost, LockKeyhole } from 'lucide-react';
import { nativePath, requireTestnet, type NativeReference } from '../../../shared/nativeProtocol';
import { useNativePayment } from './NativePaymentPage';
export function NativeCard({ reference }: { reference: NativeReference }) {
  const network = requireTestnet(reference.chainId); const query = useNativePayment(reference); const p = query.data?.payment;
  const label = query.isError ? 'Verification unavailable' : !p ? 'Verifying escrow…' : p.status === 0 ? 'Payment not found' : p.status === 2 ? 'Claimed' : p.status === 3 ? 'Refunded' : p.expiry <= query.data!.now ? 'Expired' : 'Held in escrow';
  return <div className="ms-pay-card"><div className="ms-pay-card-top"><span className="ms-pay-symbol"><Ghost size={19}/></span><span>GhostPay · {network.symbol}</span><ArrowUpRight size={16}/></div><div className="ms-pay-amount">{p ? Number(formatUnits(p.amount, network.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'} <span>{network.symbol}</span></div><p>{network.name} · Payment #{reference.paymentId}</p><div className="ms-pay-state"><span/>{label}</div><Link className="gp-native-card-link" to={nativePath(reference)}>View payment<ArrowUpRight size={15}/></Link><span className="ms-pay-card-note"><LockKeyhole size={11}/>Testnet · sender approval required</span></div>;
}
