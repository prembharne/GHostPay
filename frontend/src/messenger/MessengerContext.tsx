import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configuredServer, consumeSsoToken, matrix, rememberedSession } from './matrix';
import { createPreview, initials, type ChatMessage, type ChatRoom, type MatrixSession, type MessengerSnapshot, type PaymentReference } from './model';
import { setVaultOwner } from '../wallet/vault';

type RoomPrefs = Record<string, { pinned?: boolean; archived?: boolean; muted?: boolean }>;
const previewKey = 'ghostpay.messenger.preview.v1';
function storedPreview() { try { const value = JSON.parse(localStorage.getItem(previewKey) || 'null'); if (Array.isArray(value?.rooms) && value.rooms.length < 50 && value.messages && typeof value.messages === 'object' && !Array.isArray(value.messages) && value.rooms.every((room: ChatRoom) => room && typeof room.id === 'string' && typeof room.name === 'string' && Array.isArray(room.members) && Number.isFinite(room.lastAt) && Array.isArray(value.messages[room.id]) && value.messages[room.id].length <= 150 && value.messages[room.id].every((message: ChatMessage) => message && typeof message.id === 'string' && typeof message.body === 'string' && Number.isFinite(message.timestamp)))) return value as MessengerSnapshot; } catch {} return createPreview(); }
function storedPrefs(): RoomPrefs { try { return JSON.parse(localStorage.getItem('ghostpay.messenger.preferences.v1') || '{}'); } catch { return {}; } }
let boot: Promise<MatrixSession | undefined> | undefined;
function initialSession() { return boot ||= consumeSsoToken().then(session => session || rememberedSession()); }
interface MessengerState {
  mode: 'preview' | 'matrix'; rooms: ChatRoom[]; messages: Record<string, ChatMessage[]>; activeId: string; setActive: (id: string) => void;
  session?: MatrixSession; state: string; error: string; server: string; toast: string; notify: (message: string) => void;
  connect: (session: MatrixSession) => Promise<void>; disconnect: () => Promise<void>;
  send: (body: string, payment?: PaymentReference, reply?: ChatMessage) => Promise<void>;
  upload: (file: File) => Promise<void>; createRoom: (users: string[], name?: string, communityId?: string) => Promise<void>; createCommunity: (users: string[], name: string) => Promise<void>; invite: (roomId: string, user: string) => Promise<void>; rename: (roomId: string, name: string) => Promise<void>; removeMember: (roomId: string, user: string) => Promise<void>; leaveRoom: (roomId: string) => Promise<void>;
  updateRoom: (id: string, key: 'pinned' | 'muted' | 'archived') => void; remove: (message: ChatMessage) => Promise<void>;
  resetPreview: () => void; receipts: boolean; setReceipts: (value: boolean) => void;
}
const Context = createContext<MessengerState | null>(null);
export function MessengerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'preview' | 'matrix'>(rememberedSession() ? 'matrix' : 'preview');
  const [session, setSession] = useState<MatrixSession | undefined>(rememberedSession);
  const [preview, setPreview] = useState<MessengerSnapshot>(storedPreview);
  const [live, setLive] = useState<MessengerSnapshot>({ rooms: [], messages: {} });
  const [activeId, setActiveId] = useState('nora'); const [prefs, setPrefs] = useState<RoomPrefs>(storedPrefs);
  const [state, setState] = useState('disconnected'); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const [receipts, setReceipts] = useState(() => { try { return localStorage.getItem('ghostpay.messenger.receipts') !== 'false'; } catch { return true; } });
  const notify = useCallback((message: string) => setToast(message), []);
  const refresh = useCallback(() => { setLive(matrix.snapshot()); setState(matrix.state); setError(matrix.error); }, []);
  const connect = useCallback(async (next: MatrixSession) => { setMode('matrix'); setSession(next); setState('connecting'); setError(''); try { await matrix.start(next); refresh(); } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Could not connect.'); throw e; } }, [refresh]);
  useEffect(() => matrix.subscribe(refresh), [refresh]);
  useEffect(() => { setVaultOwner(session?.userId || 'guest'); }, [session?.userId]);
  useEffect(() => { let current = true; void initialSession().then(next => { if (current && next) return connect(next); }).catch(e => { if (current) { setError(e.message); notify('The connection needs attention. Open Settings to reconnect.'); } }); return () => { current = false; }; }, [connect, notify]);
  useEffect(() => { try { localStorage.setItem(previewKey, JSON.stringify(preview)); } catch { notify('Preview storage is full. Reset preview data in Settings.'); } }, [preview, notify]);
  useEffect(() => { try { localStorage.setItem('ghostpay.messenger.preferences.v1', JSON.stringify(prefs)); } catch {} }, [prefs]);
  useEffect(() => { try { localStorage.setItem('ghostpay.messenger.receipts', String(receipts)); } catch {} }, [receipts]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5500); return () => clearTimeout(timer); }, [toast]);
  const snapshot = mode === 'preview' ? preview : live;
  const rooms = useMemo(() => snapshot.rooms.map(room => ({ ...room, ...prefs[room.id] })).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.lastAt - a.lastAt), [snapshot.rooms, prefs]);
  useEffect(() => { if (rooms.length && !rooms.some(room => room.id === activeId)) setActiveId(rooms.find(room => !room.archived)?.id || rooms[0].id); }, [rooms, activeId]);
  async function disconnect() { await matrix.stop(); setMode('preview'); setSession(undefined); setActiveId('nora'); setState('disconnected'); setError(''); }
  function setActive(id: string) { setActiveId(id); if (mode === 'matrix' && receipts) void matrix.markRead(id).catch(() => {}); else if (mode === 'preview') setPreview(p => ({ ...p, rooms: p.rooms.map(r => r.id === id ? { ...r, unread: 0 } : r) })); }
  function append(message: ChatMessage) { setPreview(p => ({ rooms: p.rooms.map(room => room.id === activeId ? { ...room, preview: message.payment ? 'Payment link' : message.body, lastAt: message.timestamp } : room), messages: { ...p.messages, [activeId]: [...(p.messages[activeId] || []), message].slice(-150) } })); }
  async function send(body: string, payment?: PaymentReference, reply?: ChatMessage) {
    if (!activeId) throw new Error('Choose a conversation first.');
    if (mode === 'matrix') await matrix.send(activeId, body, payment, reply);
    else append({ id: crypto.randomUUID(), roomId: activeId, sender: 'you', senderName: 'You', body, timestamp: Date.now(), own: true, state: 'local', payment, ...(reply ? { reply: { id: reply.id, body: reply.body, sender: reply.senderName } } : {}) });
  }
  async function upload(file: File) {
    if (mode === 'matrix') return matrix.upload(activeId, file);
    if (file.size > 2 * 1024 * 1024) throw new Error('Preview attachments are limited to 2 MB. Connect to Matrix for larger files.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    append({ id: crypto.randomUUID(), roomId: activeId, sender: 'you', senderName: 'You', body: file.name, timestamp: Date.now(), own: true, state: 'local', attachment: { name: file.name, type: file.type, size: file.size, url: data } });
    notify('Attachment saved to this local preview. It was not uploaded or delivered.');
  }
  async function createRoom(users: string[], name?: string, communityId?: string) {
    if (mode === 'matrix') { const id = await matrix.createRoom(users, name, communityId); setActiveId(id); return; }
    const id = crypto.randomUUID(); const title = name || users[0]?.replace(/^@/, '').split(':')[0] || 'New conversation';
    const room: ChatRoom = { id, name: title, initials: initials(title), kind: name ? 'group' : 'direct', communityId, subtitle: name ? 'Preview group' : 'Preview contact', unread: 0, lastAt: Date.now(), encrypted: false,
      preview: 'A new conversation starts here.', members: [{ id: 'you', name: 'You' }, ...users.map(user => ({ id: user, name: user }))] };
    setPreview(p => ({ rooms: [room, ...p.rooms], messages: { ...p.messages, [id]: [] } })); setActiveId(id);
  }
  async function createCommunity(users: string[], name: string) {
    if (mode === 'matrix') { const result = await matrix.createCommunity(users, name); setActiveId(result.generalId); return; }
    const spaceId=crypto.randomUUID(), generalId=crypto.randomUUID(), announcementsId=crypto.randomUUID();
    const members=[{id:'you',name:'You'},...users.map(user=>({id:user,name:user}))];
    const community:ChatRoom={id:spaceId,name,initials:initials(name),kind:'community',subtitle:'Preview community',unread:0,lastAt:Date.now(),members,encrypted:false,preview:'Your people, together.'};
    const group=(id:string,label:string):ChatRoom=>({...community,id,name:`${name} · ${label}`,kind:'group',communityId:spaceId,subtitle:label==='Announcements'?'Preview announcements':'Preview group',preview:label==='Announcements'?'Updates for the whole community.':'A place for everyone to talk.'});
    setPreview(p=>({rooms:[community,group(generalId,'General'),group(announcementsId,'Announcements'),...p.rooms],messages:{...p.messages,[spaceId]:[],[generalId]:[],[announcementsId]:[]}}));setActiveId(generalId);notify('Community preview created with General and Announcements groups. Nothing was sent.');
  }
  async function invite(roomId:string,user:string){if(mode==='matrix')return matrix.invite(roomId,user);if(!user.trim())throw new Error('Enter a member name.');setPreview(p=>({...p,rooms:p.rooms.map(r=>r.id===roomId?{...r,members:[...r.members.filter(m=>m.id!==user),{id:user,name:user}]}:r)}));notify('Member added to this local preview.');}
  async function rename(roomId:string,name:string){if(mode==='matrix')return matrix.rename(roomId,name);if(!name.trim()||name.length>80)throw new Error('Use a name of 1–80 characters.');setPreview(p=>({...p,rooms:p.rooms.map(r=>r.id===roomId?{...r,name:name.trim(),initials:initials(name)}:r)}));}
  async function removeMember(roomId:string,user:string){if(mode==='matrix')return matrix.removeMember(roomId,user);setPreview(p=>({...p,rooms:p.rooms.map(r=>r.id===roomId?{...r,members:r.members.filter(m=>m.id!==user)}:r)}));}
  async function leaveRoom(roomId:string){if(mode==='matrix'){await matrix.leave(roomId);return;}setPreview(p=>({...p,rooms:p.rooms.filter(r=>r.id!==roomId)}));setActiveId('');notify('Left the preview group on this device.');}
  function updateRoom(id: string, key: 'pinned' | 'muted' | 'archived') { const current = rooms.find(room => room.id === id); setPrefs(p => ({ ...p, [id]: { ...p[id], [key]: !current?.[key] } })); notify(`${key === 'pinned' ? 'Pin' : key === 'muted' ? 'Mute' : 'Archive'} preference saved on this device.`); }
  async function remove(message: ChatMessage) { if (!message.own) throw new Error('You can remove your own messages.'); if (mode === 'matrix') return matrix.redact(message.roomId, message.id); setPreview(p => ({ ...p, messages: { ...p.messages, [message.roomId]: (p.messages[message.roomId] || []).filter(m => m.id !== message.id) } })); }
  return <Context.Provider value={{ mode, rooms, messages: snapshot.messages, activeId, setActive, session, state, error, server: session?.homeserver || configuredServer(), toast, notify, connect, disconnect, send, upload, createRoom, createCommunity, invite, rename, removeMember, leaveRoom, updateRoom, remove, resetPreview: () => { setPreview(createPreview()); setActiveId('nora'); notify('Local preview reset.'); }, receipts, setReceipts }}>{children}</Context.Provider>;
}
export function useMessenger() { const value = useContext(Context); if (!value) throw new Error('Missing messenger provider.'); return value; }
