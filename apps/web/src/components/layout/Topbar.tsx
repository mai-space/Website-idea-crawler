import { useSocketStore } from '@/store';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const connected = useSocketStore((s) => s.connected);

  return (
    <header style={{
      height: 56, borderBottom: '1px solid var(--rule)', background: 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', flexShrink: 0,
    }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: connected ? 'var(--low)' : 'var(--ink-3)',
            animation: connected ? 'sb-pulse 2s ease-in-out infinite' : 'none',
          }} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
