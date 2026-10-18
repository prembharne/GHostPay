import { isAddress } from 'viem';

export interface PaymentReference { version: 1; chainId: number; contract: string; paymentId: string }
export interface ChatMessage {
  id: string; roomId: string; sender: string; senderName: string; body: string; timestamp: number;
  own: boolean; state: 'sent' | 'sending' | 'failed' | 'local'; payment?: PaymentReference;
  previewPayment?: boolean; reply?: { id: string; body: string; sender: string }; edited?: boolean;
  attachment?: { name: string; type: string; size: number; url?: string; encrypted?: Record<string, unknown> };
}
export interface ChatRoom {
  id: string; name: string; subtitle: string; initials: string; kind: 'direct' | 'group';
  unread: number; lastAt: number; members: { id: string; name: string }[]; encrypted: boolean;
  preview: string; archived?: boolean; pinned?: boolean; muted?: boolean; invited?: boolean;
}
export interface MatrixSession { homeserver: string; userId: string; deviceId: string; accessToken: string }
export interface MessengerSnapshot { rooms: ChatRoom[]; messages: Record<string, ChatMessage[]> }
export const PAYMENT_CONTENT_KEY = 'org.ghostpay.payment';
export function parsePayment(value: unknown): PaymentReference | undefined {
  if (!value || typeof value !== 'object') return;
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || p.chainId !== 11155111 || typeof p.contract !== 'string' || !isAddress(p.contract) || typeof p.paymentId !== 'string' || !/^[1-9]\d{0,76}$/.test(p.paymentId) || BigInt(p.paymentId) >= 2n ** 256n) return;
  return { version: 1, chainId: p.chainId, contract: p.contract, paymentId: p.paymentId };
}
export function validateHomeserver(input: string): string {
  const url = new URL(input.trim());
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use the homeserver origin, without a path or credentials.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for a public homeserver.');
  return url.origin;
}
export const initials = (name: string) => name.replace(/^@/, '').split(/[ .:_-]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || 'GP';
export function timeLabel(timestamp: number) { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp); }
export function roomTime(timestamp: number) { return new Date(timestamp).toDateString() === new Date().toDateString() ? timeLabel(timestamp) : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp); }

export function createPreview(): MessengerSnapshot {
  const now = Date.now(); const t = (minutes: number) => now - minutes * 60000;
  const contacts = [
    ['nora', 'Nora Ellis', 'NE', 'direct', 'The link is ready whenever you are.', 3],
    ['studio', 'Studio Collective', 'SC', 'group', 'A place for the ideas worth sharing.', 18],
    ['alex', 'Alex Morgan', 'AM', 'direct', 'That sounds like a plan.', 43],
    ['weekend', 'Weekend people', 'WP', 'group', 'Same place. Better company.', 110],
    ['theo', 'Theo Park', 'TP', 'direct', 'See you on the other side.', 230],
  ] as const;
  const rooms: ChatRoom[] = contacts.map(([id, name, init, kind, preview, min], index) => ({
    id, name, initials: init, kind, preview, subtitle: kind === 'group' ? 'Preview group' : 'Preview contact', unread: index === 1 ? 2 : 0,
    lastAt: t(min), members: [{ id: 'you', name: 'You' }, { id, name }, ...(kind === 'group' ? [{ id: 'nora', name: 'Nora Ellis' }, { id: 'theo', name: 'Theo Park' }] : [])], encrypted: false, pinned: index === 0,
  }));
  const message = (id: string, sender: string, body: string, min: number, own = false, rest = {}): ChatMessage => ({ id, roomId: 'nora', sender, senderName: own ? 'You' : 'Nora', body, timestamp: t(min), own, state: 'local', ...rest });
  return { rooms, messages: {
    nora: [
      message('n1', 'nora', 'Hey! A little something for the work we made together.', 22),
      message('n2', 'you', 'You really didn’t have to. Loved working on it with you.', 20, true),
      message('n3', 'nora', 'I thought a payment should feel as simple as a conversation.', 18),
      message('n4', 'nora', 'Here’s what a payment looks like in a conversation.', 16, false, { previewPayment: true }),
      message('n5', 'you', 'A message, a link, and a little peace of mind. I like it.', 9, true),
      message('n6', 'nora', 'The link is ready whenever you are.', 3),
    ],
    studio: [message('s1', 'studio', 'A place for the ideas worth sharing.', 18, false, { roomId: 'studio', senderName: 'Alex' })],
    alex: [message('a1', 'alex', 'That sounds like a plan.', 43, false, { roomId: 'alex', senderName: 'Alex' })],
    weekend: [message('w1', 'weekend', 'Same place. Better company.', 110, false, { roomId: 'weekend', senderName: 'Theo' })],
    theo: [message('t1', 'theo', 'See you on the other side.', 230, false, { roomId: 'theo', senderName: 'Theo' })],
  } };
}
