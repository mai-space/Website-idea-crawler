import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type {
  IdeaBriefRow,
  IdeaComplexity,
  IdeaStatus,
  PageRow,
  PageType,
  PaginatedIdeas,
  Site,
} from '@/api/client';
import { useSocketStore } from '@/store';
import { PageTypeIcon } from './PageTypeIcon';
import { PitchCard } from '@/components/ideas/PitchCard';
import { IdeaDetailModal } from '@/components/ideas/IdeaDetailModal';

const PAGE_ORDER: PageType[] = ['landing', 'blog', 'product', 'docs', 'other'];

interface Props {
  siteId: string | null;
  onClose: () => void;
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—';
  const a = new Date(startedAt).getTime();
  const b = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.round((b - a) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function jobStatusLabel(status: string): string {
  return status;
}

type IdeaArea = 'content' | 'seo' | 'feature' | 'ux';

export function SiteDetailDrawer({ siteId, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pages' | 'history' | 'briefs'>('pages');
  const [typeFilter, setTypeFilter] = useState<PageType | null>(null);
  const [detailIdeaId, setDetailIdeaId] = useState<string | null>(null);
  const [ideaStatus, setIdeaStatus] = useState<IdeaStatus | null>(null);
  const [ideaComplexity, setIdeaComplexity] = useState<IdeaComplexity | null>(null);
  const [ideaArea, setIdeaArea] = useState<IdeaArea | null>(null);
  const socket = useSocketStore((s) => s.socket);
  const connected = useSocketStore((s) => s.connected);
  const crawlPageActivity = useSocketStore((s) => s.crawlPageActivity);

  useEffect(() => {
    if (!siteId || !socket) return;
    socket.emit('subscribe:site', siteId);
  }, [siteId, socket, connected]);

  useEffect(() => {
    if (!siteId) setTab('pages');
  }, [siteId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (detailIdeaId) setDetailIdeaId(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, detailIdeaId]);

  const { data: site } = useQuery({
    queryKey: ['site', siteId],
    queryFn: () => api.get<Site>(`/sites/${siteId}`).then((r) => r.data),
    enabled: Boolean(siteId),
  });

  const pagesQueryKey = ['site', siteId, 'pages', typeFilter ?? 'all'] as const;

  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: pagesQueryKey,
    queryFn: () => {
      const q = typeFilter ? `?type=${typeFilter}` : '';
      return api.get<PageRow[]>(`/sites/${siteId}/pages${q}`).then((r) => r.data);
    },
    enabled: Boolean(siteId) && tab === 'pages',
  });

  const ideasQueryKey = ['site', siteId, 'ideas', ideaStatus ?? 'all', ideaComplexity ?? 'all', ideaArea ?? 'all'] as const;

  const { data: ideasPage, isLoading: ideasLoading } = useQuery({
    queryKey: ideasQueryKey,
    queryFn: () => {
      const params: Record<string, string | number> = { page: 1, limit: 40, sort: 'impact' };
      if (ideaStatus) params.status = ideaStatus;
      if (ideaComplexity) params.complexity = ideaComplexity;
      if (ideaArea) params.area = ideaArea;
      return api.get<PaginatedIdeas>(`/sites/${siteId}/ideas`, { params }).then((r) => r.data);
    },
    enabled: Boolean(siteId) && tab === 'briefs',
  });

  const generateIdeas = useMutation({
    mutationFn: () => api.post<{ jobId: string; status: string }>(`/sites/${siteId}/ideas/generate`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] });
      qc.invalidateQueries({ queryKey: ['site', siteId] });
      qc.invalidateQueries({ queryKey: ['site', siteId, 'ideas'] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
    },
  });

  const patchIdeaStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IdeaStatus }) =>
      api.patch(`/ideas/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site', siteId, 'ideas'] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<PageType, PageRow[]>();
    PAGE_ORDER.forEach((t) => map.set(t, []));
    (pages ?? []).forEach((p) => {
      const list = map.get(p.type) ?? [];
      list.push(p);
      map.set(p.type, list);
    });
    return map;
  }, [pages]);

  const activityForSite = useMemo(
    () => crawlPageActivity.filter((e) => e.siteId === siteId).slice(0, 40),
    [crawlPageActivity, siteId],
  );

  if (!siteId) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(21,23,26,0.28)',
        backdropFilter: 'blur(4px)',
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        role="dialog"
        aria-modal
        aria-labelledby="site-drawer-title"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          width: 480,
          maxWidth: '100vw',
          background: 'var(--paper-2)',
          borderLeft: '1px solid var(--rule)',
          boxShadow: 'var(--shadow-2)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sb-drawer-in 220ms var(--ease-out) both',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes sb-drawer-in {
            from { transform: translateX(12px); opacity: 0.92; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        <header style={{ padding: '20px 22px 12px', borderBottom: '1px solid var(--rule)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 id="site-drawer-title" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: '-0.01em' }}>
                {site?.name ?? '…'}
              </h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4, wordBreak: 'break-all' }}>
                {site?.url}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--rule)',
                background: 'var(--paper-0)',
                cursor: 'pointer',
                color: 'var(--ink-2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'block', margin: 'auto' }}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
            {(['pages', 'history', 'briefs'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: tab === t ? 'var(--paper-0)' : 'transparent',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: tab === t ? 'var(--ink)' : 'var(--ink-2)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'pages' ? 'Pages' : t === 'history' ? 'Crawl history' : 'Briefs'}
              </button>
            ))}
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px 24px' }}>
          {tab === 'pages' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <FilterChip label="All" active={typeFilter === null} onClick={() => setTypeFilter(null)} />
                {PAGE_ORDER.map((t) => (
                  <FilterChip key={t} label={t} active={typeFilter === t} onClick={() => setTypeFilter(t)} />
                ))}
              </div>

              {pagesLoading && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>Loading pages…</p>
              )}

              {!pagesLoading && (!pages || pages.length === 0) && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>No pages yet. Start a crawl from the fleet card.</p>
              )}

              {!pagesLoading && pages && pages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {PAGE_ORDER.map((type) => {
                    const list = grouped.get(type) ?? [];
                    if (list.length === 0) return null;
                    return (
                      <section key={type}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ color: 'var(--ink-2)' }}><PageTypeIcon type={type} /></span>
                          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{type}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{list.length}</span>
                        </div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {list.map((p) => (
                            <li key={p.id} style={{ borderTop: '1px solid var(--rule)', padding: '10px 0' }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>{p.title || p.url}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4, wordBreak: 'break-all' }}>{p.url}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                                {p.parsedAt ? `parsed ${new Date(p.parsedAt).toLocaleString()}` : 'queued for parse'}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}

              <section style={{ marginTop: 28 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Activity</h3>
                {activityForSite.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>Live crawl events appear here.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activityForSite.map((e, i) => (
                      <li key={`${e.url}-${e.at}-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                        <span style={{ color: 'var(--ink-2)', marginTop: 2 }}><PageTypeIcon type={e.pageType as PageType} size={14} /></span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', wordBreak: 'break-all' }}>{e.url}</div>
                          <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{new Date(e.at).toLocaleTimeString()}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {tab === 'history' && !site && (
            <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>Loading history…</p>
          )}

          {tab === 'history' && site && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(site.crawlJobs ?? []).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>No crawl jobs yet.</p>
              )}
              {(site.crawlJobs ?? []).map((job, idx) => (
                <div
                  key={job.id}
                  style={{
                    padding: '14px 0',
                    borderTop: idx === 0 ? 'none' : '1px solid var(--rule)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 8,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
                      {job.pagesCrawled} / {job.pagesTotal} pages
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'lowercase',
                      color: 'var(--ink-2)',
                      background: 'var(--paper-0)',
                      border: '1px solid var(--rule)',
                      borderRadius: 999,
                      padding: '3px 10px',
                    }}>
                      {jobStatusLabel(job.status)}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                      {formatDuration(job.startedAt, job.finishedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'briefs' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => generateIdeas.mutate()}
                  disabled={generateIdeas.isPending || site?.status === 'analyzing' || site?.status === 'crawling'}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 16px',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--rule)',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: site?.status === 'analyzing' || site?.status === 'crawling' ? 'not-allowed' : 'pointer',
                    opacity: generateIdeas.isPending || site?.status === 'analyzing' || site?.status === 'crawling' ? 0.65 : 1,
                  }}
                >
                  {generateIdeas.isPending || site?.status === 'analyzing' ? 'Generating…' : 'Generate pitch briefs'}
                </button>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>
                  Uses parsed pages and GPT-4o. Requires <span style={{ fontFamily: 'var(--font-mono)' }}>OPENAI_API_KEY</span>.
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <FilterChip label="All status" active={ideaStatus === null} onClick={() => setIdeaStatus(null)} />
                {(['open', 'accepted', 'rejected', 'deferred', 'done'] as const).map((s) => (
                  <FilterChip key={s} label={s} active={ideaStatus === s} onClick={() => setIdeaStatus(s)} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                <FilterChip label="All complexity" active={ideaComplexity === null} onClick={() => setIdeaComplexity(null)} />
                {(['low', 'medium', 'high'] as const).map((c) => (
                  <FilterChip key={c} label={c} active={ideaComplexity === c} onClick={() => setIdeaComplexity(c)} />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                <FilterChip label="All areas" active={ideaArea === null} onClick={() => setIdeaArea(null)} />
                {(['content', 'seo', 'feature', 'ux'] as const).map((a) => (
                  <FilterChip key={a} label={a} active={ideaArea === a} onClick={() => setIdeaArea(a)} />
                ))}
              </div>

              {ideasLoading && <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading briefs…</p>}

              {!ideasLoading && ideasPage && ideasPage.items.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
                  No briefs match these filters. Generate new ideas once pages are parsed.
                </p>
              )}

              {!ideasLoading && ideasPage && ideasPage.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ideasPage.items.map((row: IdeaBriefRow) => (
                    <PitchCard
                      key={row.id}
                      idea={row}
                      onOpen={() => setDetailIdeaId(row.id)}
                      onStatus={
                        row.status === 'open'
                          ? (st) => patchIdeaStatus.mutate({ id: row.id, status: st })
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <IdeaDetailModal ideaId={detailIdeaId} onClose={() => setDetailIdeaId(null)} />
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 999,
        border: '1px solid var(--rule)',
        background: active ? 'var(--paper-0)' : 'var(--paper-2)',
        fontSize: 11,
        fontWeight: 500,
        color: active ? 'var(--ink)' : 'var(--ink-2)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        textTransform: label === 'All' || label.startsWith('All ') ? 'none' : 'lowercase',
      }}
    >
      {label}
    </button>
  );
}
