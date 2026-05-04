import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { IdeaDetail, PageType } from '@/api/client';
import { PageTypeIcon } from '@/components/sites/PageTypeIcon';

interface Props {
  ideaId: string | null;
  onClose: () => void;
}

export function IdeaDetailModal({ ideaId, onClose }: Props) {
  const qc = useQueryClient();
  const [notesDraft, setNotesDraft] = useState('');

  const { data: idea, isLoading } = useQuery({
    queryKey: ['idea', ideaId],
    queryFn: () => api.get<IdeaDetail>(`/ideas/${ideaId}`).then((r) => r.data),
    enabled: Boolean(ideaId),
  });

  useEffect(() => {
    if (idea?.notes != null) setNotesDraft(idea.notes);
    else setNotesDraft('');
  }, [idea?.notes, ideaId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = useMutation({
    mutationFn: (body: { status?: IdeaDetail['status']; notes?: string }) =>
      api.patch(`/ideas/${ideaId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['idea', ideaId] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
      if (idea?.siteId) qc.invalidateQueries({ queryKey: ['site', idea.siteId, 'ideas'] });
      qc.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  if (!ideaId) return null;

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(21,23,26,0.32)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        style={{
          width: 'min(560px, 100%)',
          maxHeight: 'min(90vh, 720px)',
          overflow: 'auto',
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-2)',
          padding: 24,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              {idea?.siteName ?? '…'}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.02em' }}>
              {isLoading ? '…' : idea?.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
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

        {isLoading && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-3)' }}>Loading briefing…</p>
        )}

        {!isLoading && idea && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{idea.pitchText}</p>

            {idea.cmsHint && (
              <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink-3)' }}>CMS: </span>
                {idea.cmsHint}
              </p>
            )}

            {idea.reasoning && (
              <section>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>Reasoning</div>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{idea.reasoning}</p>
              </section>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
              <span>{idea.complexity}</span>
              <span>{idea.displayHours}h estimated</span>
              <span>impact {idea.impactScore.toFixed(2)}</span>
              <span style={{ textTransform: 'lowercase' }}>{idea.status}</span>
            </div>

            <section>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>Source pages</div>
              {idea.sourcePages.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>No linked pages.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {idea.sourcePages.map((p) => (
                    <li key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ marginTop: 2 }}><PageTypeIcon type={p.type as PageType} size={14} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{p.title || p.url}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', wordBreak: 'break-all' }}>{p.url}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Notes</span>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  padding: 10,
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: 'var(--paper-0)',
                  color: 'var(--ink)',
                  resize: 'vertical',
                }}
              />
              <button
                type="button"
                disabled={patch.isPending || notesDraft === (idea.notes ?? '')}
                onClick={() => patch.mutate({ notes: notesDraft })}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  padding: '6px 14px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: 'var(--paper-0)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: patch.isPending ? 'wait' : 'pointer',
                }}
              >
                Save notes
              </button>
            </label>

            {idea.status === 'open' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid var(--rule)' }}>
                <button type="button" className="sb-modal-act pri" disabled={patch.isPending} onClick={() => patch.mutate({ status: 'accepted' })}>Accept</button>
                <button type="button" className="sb-modal-act" disabled={patch.isPending} onClick={() => patch.mutate({ status: 'deferred' })}>Defer</button>
                <button type="button" className="sb-modal-act danger" disabled={patch.isPending} onClick={() => patch.mutate({ status: 'rejected' })}>Reject</button>
              </div>
            )}
          </div>
        )}

        <style>{`
          .sb-modal-act {
            font-family: var(--font-ui);
            font-size: 12px;
            font-weight: 500;
            padding: 8px 14px;
            border-radius: var(--r-md);
            border: 1px solid var(--rule);
            background: var(--paper-0);
            color: var(--ink-2);
            cursor: pointer;
          }
          .sb-modal-act.pri { background: var(--accent); color: #fff; border-color: var(--accent); }
          .sb-modal-act.danger { color: var(--high); border-color: var(--high-bg); }
        `}</style>
      </div>
    </div>
  );
}
