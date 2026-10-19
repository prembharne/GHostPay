import { ClientEvent, EventType, IndexedDBStore, MatrixEventEvent, MsgType, NotificationCountType, Preset, RelationType, RoomEvent, RoomMemberEvent, SyncState, createClient, type MatrixClient, type MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { encryptAttachment, decryptAttachment } from 'matrix-encrypt-attachment';
import { PAYMENT_CONTENT_KEY, initials, parsePayment, validateHomeserver, type ChatMessage, type ChatRoom, type MatrixSession, type MessengerSnapshot, type PaymentReference } from './model';

const sessionKey = 'ghostpay.matrix.session.v1';
const serverKey = 'ghostpay.matrix.homeserver.v1';
export function configuredServer(): string { try { return sessionStorage.getItem(serverKey) || import.meta.env.VITE_MATRIX_HOMESERVER || ''; } catch { return import.meta.env.VITE_MATRIX_HOMESERVER || ''; } }
export function rememberedSession(): MatrixSession | undefined {
  try { const value = JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); return value && typeof value.accessToken === 'string' && typeof value.deviceId === 'string' && typeof value.userId === 'string' && validateHomeserver(value.homeserver) ? value : undefined; } catch { return; }
}
export function forgetSession() { sessionStorage.removeItem(sessionKey); }
export async function discoverServer(input: string) {
  const homeserver = validateHomeserver(input);
  const response = await fetch(`${homeserver}/_matrix/client/v3/login`, { signal: AbortSignal.timeout(12000), credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('Could not discover login options. Check the Matrix server URL.');
  const data = await response.json() as { flows?: { type: string; identity_providers?: { id: string; name: string; brand?: string }[] }[] };
  sessionStorage.setItem(serverKey, homeserver);
  return { homeserver, password: !!data.flows?.some(f => f.type === 'm.login.password'), sso: data.flows?.find(f => f.type === 'm.login.sso') };
}
export function startSso(homeserver: string, idpId?: string) {
  sessionStorage.setItem(serverKey, validateHomeserver(homeserver));
  const redirect = `${window.location.origin}/chat`;
  window.location.assign(createClient({ baseUrl: homeserver }).getSsoLoginUrl(redirect, 'sso', idpId));
}
export async function passwordLogin(homeserver: string, user: string, password: string) {
  const client = createClient({ baseUrl: validateHomeserver(homeserver) });
  const login = await client.login('m.login.password', { identifier: { type: 'm.id.user', user }, password, initial_device_display_name: 'GhostPay Web' });
  const session: MatrixSession = { homeserver, userId: login.user_id, deviceId: login.device_id, accessToken: login.access_token };
  sessionStorage.setItem(sessionKey, JSON.stringify(session)); return session;
}
export async function consumeSsoToken(): Promise<MatrixSession | undefined> {
  const url = new URL(window.location.href); const token = url.searchParams.get('loginToken'); if (!token) return;
  url.searchParams.delete('loginToken'); window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  const homeserver = configuredServer(); if (!homeserver) throw new Error('Login could not be completed. Return to the connection screen.');
  const client = createClient({ baseUrl: validateHomeserver(homeserver) });
  const login = await client.login('m.login.token', { token, initial_device_display_name: 'GhostPay Web' });
  const session: MatrixSession = { homeserver, userId: login.user_id, deviceId: login.device_id, accessToken: login.access_token };
  sessionStorage.setItem(sessionKey, JSON.stringify(session)); return session;
}

class MatrixService {
  client?: MatrixClient;
  state = 'disconnected'; error = ''; private listeners = new Set<() => void>();
  private opening?: Promise<void>; private identity = ''; private releaseLock?: () => void; private generation = 0;
  private updateTimer?: ReturnType<typeof setTimeout>;
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private notify = () => { clearTimeout(this.updateTimer); this.updateTimer = setTimeout(() => this.listeners.forEach(fn => fn()), 40); };
  async start(session: MatrixSession) {
    const identity = `${session.homeserver}/${session.userId}/${session.deviceId}`;
    if (this.identity === identity && this.opening) return this.opening;
    if (this.client) await this.stop(false);
    const generation = ++this.generation; let startingClient: MatrixClient | undefined; let release: (() => void) | undefined;
    const ensureCurrent = () => { if (generation !== this.generation) throw new Error('Connection was cancelled.'); };
    this.identity = identity; this.state = 'connecting'; this.error = ''; this.notify();
    this.opening = new Promise<void>((resolve, reject) => {
      const connect = async () => {
        try {
          ensureCurrent();
          const store = new IndexedDBStore({ indexedDB: window.indexedDB, localStorage: window.localStorage, dbName: `ghostpay.events.${session.userId}.${session.deviceId}` });
          const client = createClient({ baseUrl: validateHomeserver(session.homeserver), accessToken: session.accessToken, userId: session.userId, deviceId: session.deviceId, store });
          this.client = client; startingClient = client;
          await store.startup(); ensureCurrent();
          await client.whoami(); ensureCurrent();
          await client.initRustCrypto({ useIndexedDB: true, cryptoDatabasePrefix: `ghostpay.crypto.${session.userId}.${session.deviceId}` }); ensureCurrent();
          client.on(ClientEvent.Sync, state => { this.state = state === SyncState.Prepared || state === SyncState.Syncing ? 'connected' : state === SyncState.Error ? 'reconnecting' : 'connecting'; this.notify(); });
          client.on(RoomEvent.Timeline, this.notify); client.on(RoomEvent.Name, this.notify); client.on(RoomEvent.MyMembership, this.notify);
          client.on(MatrixEventEvent.Decrypted, this.notify); client.on(RoomMemberEvent.Typing, this.notify);
          client.on(ClientEvent.Room, this.notify); client.on(RoomEvent.Receipt, this.notify); client.on(RoomEvent.LocalEchoUpdated, this.notify);
          await client.startClient({ initialSyncLimit: 40, lazyLoadMembers: true }); ensureCurrent(); resolve();
        } catch (error) { startingClient?.stopClient(); startingClient?.removeAllListeners(); release?.(); if (generation === this.generation) { this.error = error instanceof Error ? error.message : 'Matrix connection failed.'; this.state = 'error'; this.notify(); } reject(error); }
      };
      if (!navigator.locks) { reject(new Error('This browser cannot safely lock encrypted device storage. Use a current browser.')); return; }
      void navigator.locks.request(`ghostpay.matrix.${identity}`, { ifAvailable: true }, async lock => {
        if (!lock) { this.state = 'error'; this.error = 'This messaging device is open in another tab. Close it there before connecting here.'; this.notify(); reject(new Error(this.error)); return; }
        if (generation !== this.generation) { reject(new Error('Connection was cancelled.')); return; }
        const released = new Promise<void>(r => { this.releaseLock = r; release = r; });
        await connect(); if (this.state !== 'error') await released;
      }).catch(reject);
    });
    return this.opening;
  }
  async stop(logout = true) {
    ++this.generation; const client = this.client;
    client?.stopClient(); client?.removeAllListeners(); this.client = undefined; this.opening = undefined; this.identity = ''; this.state = 'disconnected'; this.error = ''; this.releaseLock?.(); this.releaseLock = undefined; this.notify();
    if (logout) { forgetSession(); try { await client?.logout(); } catch { /* The local session is still removed. */ } }
  }
  snapshot(): MessengerSnapshot {
    const client = this.client; if (!client) return { rooms: [], messages: {} };
    const messages: Record<string, ChatMessage[]> = {};
    const rooms = client.getRooms().filter(r => ['join', 'invite'].includes(r.getMyMembership())).map(room => {
      const members = room.getJoinedMembers().map(member => ({ id: member.userId, name: member.name }));
      const other = members.filter(member => member.id !== client.getUserId());
      const events = room.getLiveTimeline().getEvents().filter(event => event.getType() === EventType.RoomMessage || event.isDecryptionFailure());
      messages[room.roomId] = events.filter(event => !event.isRedacted() && !event.getContent()['m.relates_to']?.rel_type).map(event => this.message(event));
      const last = messages[room.roomId].at(-1);
      const space = room.getType() === 'm.space';
      const direct = !space && !room.currentState.getStateEvents(EventType.RoomName, '') && members.length <= 2 && room.getMyMembership() !== 'invite';
      const parent = room.currentState.getStateEvents(EventType.SpaceParent).find(event => event.getContent().canonical)?.getStateKey();
      const name = room.name || other[0]?.name || 'New conversation';
      return { id: room.roomId, name, subtitle: room.getMyMembership() === 'invite' ? 'Invitation · review before joining' : direct ? other[0]?.id || 'Private conversation' : `${members.length} members`,
        initials: initials(name), kind: space ? 'community' : direct ? 'direct' : 'group', communityId: parent, unread: room.getUnreadNotificationCount(NotificationCountType.Total), lastAt: last?.timestamp || 0,
        members, canManage: room.currentState.maySendStateEvent(EventType.RoomName, client.getUserId()!), canSend: room.currentState.maySendEvent(EventType.RoomMessage, client.getUserId()!), encrypted: client.isRoomEncrypted(room.roomId), preview: last?.payment ? 'Payment link' : last?.body || 'Start a conversation', invited: room.getMyMembership() === 'invite',
      } satisfies ChatRoom;
    }).sort((a, b) => b.lastAt - a.lastAt);
    return { rooms, messages };
  }
  private message(event: MatrixEvent): ChatMessage {
    const content = event.getContent(); const room = this.client?.getRoom(event.getRoomId() || '');
    const replyId = content['m.relates_to']?.['m.in_reply_to']?.event_id; const replied = typeof replyId === 'string' ? room?.findEventById(replyId) : undefined;
    const attachment = [MsgType.File, MsgType.Image, MsgType.Audio, MsgType.Video].includes(content.msgtype as MsgType) ? {
      name: String(content.body || 'Attachment'), type: String(content.info?.mimetype || 'application/octet-stream'), size: Number(content.info?.size || 0),
      url: typeof content.url === 'string' ? content.url : undefined, encrypted: content.file as Record<string, unknown> | undefined,
    } : undefined;
    return { id: event.getId() || event.getTxnId() || crypto.randomUUID(), roomId: event.getRoomId() || '', sender: event.getSender() || '', senderName: room?.getMember(event.getSender() || '')?.name || event.getSender() || 'Unknown',
      body: event.isDecryptionFailure() ? 'Unable to decrypt this message on this device. Verify your device or restore your keys.' : String(content.body || ''),
      timestamp: event.getTs(), own: event.getSender() === this.client?.getUserId(), state: event.status === 'not_sent' ? 'failed' : event.status ? 'sending' : 'sent',
      payment: parsePayment(content[PAYMENT_CONTENT_KEY]), attachment,
      ...(typeof replyId === 'string' ? { reply: { id: replyId, body: String(replied?.getContent().body || 'Earlier message'), sender: room?.getMember(replied?.getSender() || '')?.name || 'Reply' } } : {}),
    };
  }
  async send(roomId: string, body: string, payment?: PaymentReference, reply?: ChatMessage) {
    const client = this.require(); if (!client.isRoomEncrypted(roomId)) throw new Error('GhostPay only sends to encrypted rooms. Create an encrypted conversation first.');
    if (!body.trim() || body.length > 16000) throw new Error('Messages must contain 1–16,000 characters.');
    const content = { msgtype: MsgType.Text as const, body, ...(payment ? { [PAYMENT_CONTENT_KEY]: payment } : {}), ...(reply ? { 'm.relates_to': { 'm.in_reply_to': { event_id: reply.id } } } : {}) };
    await client.sendMessage(roomId, content); this.notify();
  }
  async createRoom(users: string[], name?: string, communityId?: string, announcements = false) {
    const client = this.require(); if ((!name && users.length !== 1) || users.some(user => !/^@[^\s:]+:[^\s]+$/.test(user))) throw new Error('Enter complete Matrix IDs, such as @name:server.example.');
    const creator = client.getUserId()!;
    const response = await client.createRoom({ preset: Preset.PrivateChat, invite: [...new Set(users)], is_direct: !name,
      ...(name ? { name } : {}), initial_state: [{ type: EventType.RoomEncryption, state_key: '', content: { algorithm: 'm.megolm.v1.aes-sha2' } }],
      ...(announcements ? { power_level_content_override: { users: { [creator]: 100 }, users_default: 0, events_default: 50, state_default: 50, invite: 50, kick: 50, ban: 50, redact: 50 } } : {}),
    });
    if (communityId) {
      const server = creator.split(':').slice(1).join(':');
      await client.sendStateEvent(communityId, EventType.SpaceChild, { via: [server], suggested: true }, response.room_id);
      await client.sendStateEvent(response.room_id, EventType.SpaceParent, { via: [server], canonical: true }, communityId);
    }
    this.notify(); return response.room_id;
  }
  async createCommunity(users: string[], name: string) {
    const client = this.require(); if (!name.trim() || name.length > 80 || users.some(user => !/^@[^\s:]+:[^\s]+$/.test(user))) throw new Error('Use a community name and complete Matrix member IDs.');
    const space = await client.createRoom({ name: name.trim(), creation_content: { type: 'm.space' }, preset: Preset.PrivateChat, invite: [...new Set(users)] });
    try {
      const generalId = await this.createRoom(users, `${name.trim()} · General`, space.room_id);
      await this.createRoom(users, `${name.trim()} · Announcements`, space.room_id, true);
      this.notify(); return { spaceId: space.room_id, generalId };
    } catch {
      this.notify(); throw new Error('The community was created, but child-group setup is incomplete. Check your communities before creating another.');
    }
  }

  async invite(roomId: string, userId: string) { if (!/^@[^\s:]+:[^\s]+$/.test(userId)) throw new Error('Enter a complete Matrix ID.'); await this.require().invite(roomId, userId); this.notify(); }
  async rename(roomId: string, name: string) { if (!name.trim() || name.length > 80) throw new Error('Use a name of 1–80 characters.'); await this.require().setRoomName(roomId, name.trim()); this.notify(); }
  async removeMember(roomId: string, userId: string) { await this.require().kick(roomId, userId, 'Removed by a group administrator'); this.notify(); }
  async join(roomId: string) { await this.require().joinRoom(roomId); this.notify(); }
  async leave(roomId: string) { await this.require().leave(roomId); this.notify(); }
  async react(roomId: string, eventId: string, key: string) {
    const client = this.require(); await client.sendEvent(roomId, EventType.Reaction, { 'm.relates_to': { rel_type: RelationType.Annotation, event_id: eventId, key } });
  }
  async redact(roomId: string, eventId: string) { await this.require().redactEvent(roomId, eventId); this.notify(); }
  async earlier(roomId: string) { const client = this.require(); const room = client.getRoom(roomId); if (room) await client.paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: 40 }); this.notify(); }
  typing(roomId: string, active: boolean) { void this.client?.sendTyping(roomId, active, 6000).catch(() => {}); }
  typingNames(roomId: string) { return this.client?.getRoom(roomId)?.getJoinedMembers().filter(m => m.typing && m.userId !== this.client?.getUserId()).map(m => m.name) || []; }
  async markRead(roomId: string) { const client = this.require(); const event = client.getRoom(roomId)?.getLiveTimeline().getEvents().at(-1); if (event) await client.sendReadReceipt(event); }
  async upload(roomId: string, file: File) {
    const client = this.require(); if (!client.isRoomEncrypted(roomId)) throw new Error('Attachments require an encrypted room.');
    if (file.size > 15 * 1024 * 1024) throw new Error('Choose a file smaller than 15 MB.');
    const encrypted = await encryptAttachment(await file.arrayBuffer());
    const response = await client.uploadContent(new Blob([encrypted.data as ArrayBuffer], { type: 'application/octet-stream' }), { name: 'encrypted-attachment', type: 'application/octet-stream', includeFilename: false });
    await client.sendMessage(roomId, { msgtype: file.type.startsWith('image/') ? MsgType.Image : file.type.startsWith('audio/') ? MsgType.Audio : MsgType.File, body: file.name,
      info: { size: file.size, mimetype: file.type }, file: { ...encrypted.info, url: response.content_uri },
    } as RoomMessageEventContent); this.notify();
  }
  async download(attachment: NonNullable<ChatMessage['attachment']>) {
    const client = this.require(); const mxc = attachment.encrypted?.url || attachment.url;
    if (typeof mxc !== 'string' || !mxc.startsWith('mxc://')) throw new Error('Invalid attachment location.');
    const url = client.mxcUrlToHttp(mxc, undefined, undefined, undefined, false, true, true); if (!url) throw new Error('Attachment is unavailable.');
    if (new URL(url).origin !== new URL(client.getHomeserverUrl()).origin) throw new Error('Unexpected media origin.');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${client.getAccessToken()}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('Could not download this attachment.');
    if (Number(response.headers.get('content-length') || 0) > 16 * 1024 * 1024) throw new Error('Attachment is too large.');
    if (!response.body) throw new Error('Attachment data is unavailable.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 16 * 1024 * 1024) { await reader.cancel(); throw new Error('Attachment is too large.'); } chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } const data = bytes.buffer;
    if (attachment.encrypted && (!attachment.encrypted.key || typeof attachment.encrypted.iv !== 'string')) throw new Error('Invalid encrypted attachment.');
    const decrypted = attachment.encrypted ? await decryptAttachment(data, attachment.encrypted as unknown as Parameters<typeof decryptAttachment>[1]) : data;
    return new Blob([decrypted as ArrayBuffer], { type: 'application/octet-stream' });
  }
  private require() { if (!this.client) throw new Error('Connect to your Matrix server first.'); return this.client; }
}
export const matrix = new MatrixService();
