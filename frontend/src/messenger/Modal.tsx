import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal();
    return () => { dialog?.close(); before?.focus(); };
  }, []);
  return <dialog ref={ref} className={`ms-modal${wide ? ' ms-modal-wide' : ''}`} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ms-modal-body"><button className="ms-icon ms-modal-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button>
      {eyebrow && <p className="ms-kicker">{eyebrow}</p>}<h2 id={titleId}>{title}</h2>{children}
    </div>
  </dialog>;
}
