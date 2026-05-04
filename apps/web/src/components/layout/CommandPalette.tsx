import { useEffect, useMemo, useState } from 'react';

export interface CommandAction {
  id: string;
  label: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

export function CommandPalette({ open, onClose, actions }: Props) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(s) || a.id.includes(s));
  }, [actions, q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 450,
        background: 'rgba(21,23,26,0.35)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        style={{
          width: 'min(480px, 94vw)',
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-2)',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command…"
          style={{
            width: '100%',
            border: 'none',
            borderBottom: '1px solid var(--rule)',
            padding: '14px 16px',
            fontSize: 15,
            fontFamily: 'var(--font-ui)',
            outline: 'none',
            background: 'var(--paper-0)',
            color: 'var(--ink)',
          }}
        />
        <ul style={{ listStyle: 'none', margin: 0, padding: 8, maxHeight: 320, overflow: 'auto' }}>
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  a.run();
                  onClose();
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 'var(--r-md)',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}
              >
                {a.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>No matches.</li>
          )}
        </ul>
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-3)', borderTop: '1px solid var(--rule)' }}>
          ⌘K to toggle · Esc to close
        </div>
      </div>
    </div>
  );
}
