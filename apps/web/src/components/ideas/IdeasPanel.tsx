import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { PaginatedIdeas } from '@/api/client';
import { useState } from 'react';
import { PitchCard } from './PitchCard';
import { IdeaDetailModal } from './IdeaDetailModal';

export function IdeasPanel() {
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ideas', 'panel'],
    queryFn: () =>
      api.get<PaginatedIdeas>('/ideas', { params: { limit: 8, sort: 'impact', status: 'open', page: 1 } }).then((r) => r.data),
  });

  return (
    <>
      <section style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--shadow-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Top briefs
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {data ? `${data.items.length} / ${data.total}` : ''}
          </span>
        </div>

        {isLoading && <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>Loading ideas…</p>}

        {!isLoading && data && data.items.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, margin: 0 }}>
            No open briefs yet. Parse a site, then generate pitch ideas from the site drawer.
          </p>
        )}

        {!isLoading && data && data.items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.items.map((row) => (
              <PitchCard
                key={row.id}
                idea={row}
                siteLabel={row.site?.name}
                compact
                onOpen={() => setDetailId(row.id)}
              />
            ))}
          </div>
        )}
      </section>

      <IdeaDetailModal ideaId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}
