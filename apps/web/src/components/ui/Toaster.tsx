import { useToastStore } from '@/store/toastStore';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: 'auto',
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--rule)',
            background: 'var(--paper-2)',
            boxShadow: 'var(--shadow-2)',
            fontSize: 13,
            fontFamily: 'var(--font-ui)',
            color: t.variant === 'error' ? 'var(--high)' : 'var(--ink)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ lineHeight: 1.45 }}>{t.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
