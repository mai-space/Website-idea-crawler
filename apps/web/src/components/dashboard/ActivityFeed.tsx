import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSocketStore } from '@/store';
import { PageTypeIcon } from '@/components/sites/PageTypeIcon';
import type { PageType } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Site } from '@/api/client';

export function ActivityFeed() {
  const activity = useSocketStore((s) => s.crawlPageActivity);
  const [siteFilter, setSiteFilter] = useState<string>('');
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get<Site[]>('/sites').then((r) => r.data),
  });

  const rows = useMemo(() => {
    let list = activity;
    if (siteFilter) list = list.filter((e) => e.siteId === siteFilter);
    return list;
  }, [activity, siteFilter]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  return (
    <section style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          Activity stream
        </div>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--rule)',
            background: 'var(--paper-0)',
            fontFamily: 'var(--font-ui)',
            color: 'var(--ink-2)',
          }}
        >
          <option value="">All sites</option>
          {(sites ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Crawl events appear here when pages are fetched or re-parsed.</p>
      ) : (
        <div
          ref={parentRef}
          style={{ height: 280, overflow: 'auto', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', background: 'var(--paper-0)' }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const e = rows[vi.index];
              return (
                <div
                  key={vi.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--rule)',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'flex-start',
                    fontSize: 12,
                  }}
                >
                  <span style={{ marginTop: 2 }}><PageTypeIcon type={e.pageType as PageType} size={14} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{e.url}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{new Date(e.at).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
