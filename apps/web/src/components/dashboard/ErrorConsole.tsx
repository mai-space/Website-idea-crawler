import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CrawlErrorApiRow } from '@/api/client';
import { useSocketStore } from '@/store';
import { useToastStore } from '@/store/toastStore';

export function ErrorConsole() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const live = useSocketStore((s) => s.errorLog);

  const { data: rows } = useQuery({
    queryKey: ['dashboard', 'crawl-errors'],
    queryFn: () => api.get<CrawlErrorApiRow[]>('/dashboard/crawl-errors').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const startCrawl = useMutation({
    mutationFn: (siteId: string) => api.post(`/sites/${siteId}/crawl`, { depth: 2 }),
    onSuccess: (_, siteId) => {
      pushToast('Crawl queued for retry', 'success');
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site', siteId] });
    },
    onError: () => pushToast('Could not start crawl', 'error'),
  });

  const merged = [...live.map((e) => ({
    at: new Date(e.at).toISOString(),
    siteId: e.siteId,
    siteName: '—',
    crawlJobId: '',
    url: undefined as string | undefined,
    error: `${e.type}: ${e.message}`,
  })), ...(rows ?? [])].slice(0, 40);

  return (
    <section style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-1)' }}>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>
        Error console
      </div>
      {merged.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>No crawl errors recorded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 260, overflow: 'auto' }}>
          {merged.map((r, i) => (
            <li
              key={`${r.crawlJobId}-${r.at}-${i}`}
              style={{
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                alignItems: 'start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{r.siteName} · {r.at ? new Date(r.at).toLocaleString() : ''}</div>
                {r.url && <div style={{ fontSize: 11, wordBreak: 'break-all', marginTop: 4, color: 'var(--ink-2)' }}>{r.url}</div>}
                <div style={{ fontSize: 12, color: 'var(--high)', marginTop: 4 }}>{r.error}</div>
              </div>
              {r.siteId && (
                <button
                  type="button"
                  disabled={startCrawl.isPending}
                  onClick={() => startCrawl.mutate(r.siteId)}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--rule)',
                    background: 'var(--paper-0)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Re-queue crawl
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
