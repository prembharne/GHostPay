import { useState } from 'react';
import { friendlyError } from '../lib/api';
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await fn(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } }
  return { busy, error, notice, setNotice, run };
}
