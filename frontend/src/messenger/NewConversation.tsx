import { useState, type FormEvent } from 'react';
import { ArrowRight, LoaderCircle, MessageCircle, Users } from 'lucide-react';
import { Modal } from './Modal';
import { useMessenger } from './MessengerContext';
export function NewConversation({ onClose }: { onClose: () => void }) {
  const chat = useMessenger(); const [kind, setKind] = useState('direct'); const [people, setPeople] = useState(''); const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await chat.createRoom(people.split(/[,\n]/).map(s => s.trim()).filter(Boolean), kind === 'group' ? name.trim() : undefined); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <Modal title="Say something good." eyebrow="A NEW CONVERSATION" onClose={onClose}><p className="ms-modal-copy">A familiar face. A new idea. It all starts with a hello.</p>
    <div className="ms-segments"><button className={kind === 'direct' ? 'selected' : ''} onClick={() => setKind('direct')}><MessageCircle size={16}/>Direct message</button><button className={kind === 'group' ? 'selected' : ''} onClick={() => setKind('group')}><Users size={16}/>Private group</button></div>
    <form className="ms-form" onSubmit={submit}>{kind === 'group' && <><label htmlFor="group-name">Group name</label><input id="group-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your kind of people" required maxLength={80}/></>}
      <label htmlFor="chat-people">{chat.mode === 'preview' ? 'Preview contact name' : kind === 'group' ? 'Matrix IDs, separated by commas' : 'Their Matrix ID'}</label><input id="chat-people" value={people} onChange={e => setPeople(e.target.value)} placeholder={chat.mode === 'preview' ? 'e.g. Jamie' : '@name:server.example'} required maxLength={1000}/>
      {chat.mode === 'preview' && <p className="ms-fine">This creates a local preview conversation. No invitation or message will be sent.</p>}
      {error && <p className="ms-alert" role="alert">{error}</p>}<button className="ms-button ms-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <ArrowRight size={16}/>}Start a conversation</button>
    </form></Modal>;
}
