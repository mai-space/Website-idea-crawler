import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Site } from '@/api/client';

interface Props {
  site: Site;
  onOpenDetail?: (siteId: string) => void;
}

const STATUS_DOT: Record<Site['status'], { bg: string; dot: string; label: string }> = {
  idle:      { bg: 'var(--paper-0)',  dot: 'var(--ink-3)', label: 'idle' },
  crawling:  { bg: 'var(--low-bg)',   dot: 'var(--low)',   label: 'crawling' },
  analyzing: { bg: 'var(--med-bg)',   dot: 'var(--med)',   label: 'analyzing' },
  error:     { bg: 'var(--high-bg)', dot: 'var(--high)',   label: 'error' },
};

export function SiteTile({ site, onOpenDetail }: Props) {
  const qc = useQueryClient();
  const status = STATUS_DOT[site.status];

  const activeJob = site.crawlJobs[0];
  const progress = activeJob && activeJob.pagesTotal > 0
    ? Math.round((activeJob.pagesCrawled / activeJob.pagesTotal) * 100)
    : 0;

  const startCrawl = useMutation({
    mutationFn: () => api.post(`/sites/${site.id}/crawl`, { depth: 3 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const stopCrawl = useMutation({
    mutationFn: () => api.delete(`/sites/${site.id}/crawl`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  return (
    <div
      role={onOpenDetail ? 'button' : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onKeyDown={onOpenDetail ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(site.id);
        }
      } : undefined}
      onClick={() => onOpenDetail?.(site.id)}
      style={{
      background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)',
      padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-1)',
      transition: 'box-shadow var(--dur-base) var(--ease-out)',
      cursor: onOpenDetail ? 'pointer' : 'default',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,23,26,0.08), 0 1px 0 rgba(21,23,26,0.02)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-1)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, letterSpacing: '-0.01em' }}>{site.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {site.cms} · priority {site.priority}
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: status.bg, fontSize: 11, fontWeight: 500, color: 'var(--ink-2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, animation: site.status === 'crawling' ? 'sb-pulse 1.6s ease-in-out infinite' : 'none' }} />
          {status.label}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Stat label="Pages" value={site._count.pages.toLocaleString()} />
        <Stat label="Briefs" value={site._count.ideas.toString()} />
        <Stat label="Health" value={site.healthScore != null ? site.healthScore.toFixed(2) : '—'} />
      </div>

      {site.status === 'crawling' && (
        <>
          <div style={{ height: 4, background: 'var(--paper-0)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: `${progress}%`, transition: 'width var(--dur-slow)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            <span>{activeJob?.pagesCrawled ?? 0} / {activeJob?.pagesTotal ?? 0} pages</span>
            <span>{progress}%</span>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        {site.status !== 'crawling' ? (
          <button
            onClick={(e) => { e.stopPropagation(); startCrawl.mutate(); }}
            disabled={startCrawl.isPending}
            style={btnStyle('var(--accent)', '#fff')}
          >
            {startCrawl.isPending ? 'Starting…' : 'Start crawl'}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); stopCrawl.mutate(); }}
            disabled={stopCrawl.isPending}
            style={btnStyle('var(--paper-2)', 'var(--ink)')}
          >
            Stop
          </button>
        )}
        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ ...btnStyle('var(--paper-0)', 'var(--ink-2)'), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {site.url.replace(/^https?:\/\//, '')}
          </span>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    background: bg, color, border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
    padding: '6px 12px', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-ui)',
    cursor: 'pointer', transition: 'opacity var(--dur-fast)',
  };
}
