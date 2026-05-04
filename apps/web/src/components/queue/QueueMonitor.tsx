import { useSocketStore } from '@/store';

export function QueueMonitor() {
  const { queueStats, connected } = useSocketStore();

  const queues = [
    { label: 'crawl', value: queueStats.crawl, color: 'var(--accent)' },
    { label: 'parse', value: queueStats.parse, color: 'var(--med)' },
    { label: 'ideas', value: queueStats.ideas, color: 'var(--low)' },
  ];

  const maxVal = Math.max(...queues.map((q) => q.value), 1);

  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Queue monitor</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          {queueStats.workers} workers {connected ? '· live' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {queues.map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{value}</span>
            </div>
            <div style={{ height: 4, background: 'var(--paper-0)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: color, borderRadius: 2,
                width: `${(value / maxVal) * 100}%`,
                transition: 'width var(--dur-slow) var(--ease-out)',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
