import type { IdeaBriefRow } from '@/api/client';

const COMPLEXITY_STYLE: Record<IdeaBriefRow['complexity'], { bg: string; fg: string; label: string }> = {
  low: { bg: 'var(--low-bg)', fg: 'var(--low)', label: 'low' },
  medium: { bg: 'var(--med-bg)', fg: 'var(--med)', label: 'medium' },
  high: { bg: 'var(--high-bg)', fg: 'var(--high)', label: 'high' },
};

function displayHours(row: IdeaBriefRow): number {
  return row.customHours ?? row.estimatedHours;
}

interface Props {
  idea: IdeaBriefRow;
  siteLabel?: string;
  onOpen: () => void;
  onStatus?: (status: 'accepted' | 'rejected' | 'deferred') => void;
  compact?: boolean;
}

export function PitchCard({ idea, siteLabel, onOpen, onStatus, compact }: Props) {
  const cx = COMPLEXITY_STYLE[idea.complexity];
  const hours = displayHours(idea);
  const manual = idea.customHours != null;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        background: 'var(--paper-2)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r-lg)',
        padding: compact ? 14 : 18,
        boxShadow: 'var(--shadow-1)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 6,
              background: cx.bg,
              color: cx.fg,
            }}
          >
            {cx.label}
          </span>
          {idea.areas.map((a) => (
            <span
              key={a}
              style={{
                fontSize: 10,
                fontWeight: 500,
                textTransform: 'lowercase',
                padding: '3px 8px',
                borderRadius: 999,
                border: '1px solid var(--rule)',
                color: 'var(--ink-2)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {a}
            </span>
          ))}
          {idea.requiresDev && (
            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>dev</span>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>
          {hours}h{manual ? ' · manual' : ''}
        </div>
      </div>

      {siteLabel && (
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-ui)' }}>{siteLabel}</div>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: compact ? 15 : 17, fontWeight: 500, margin: 0, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
        {idea.title}
      </h3>

      {!compact && (
        <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {idea.pitchText}
        </p>
      )}

      {idea.cmsHint != null && idea.cmsHint !== '' && !compact && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)', margin: 0, fontFamily: 'var(--font-ui)' }}>
          <span style={{ fontWeight: 600, color: 'var(--ink-3)' }}>CMS: </span>
          {idea.cmsHint}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>Impact</span>
        <div style={{ flex: 1, height: 4, background: 'var(--paper-0)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(idea.impactScore * 100)}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{idea.impactScore.toFixed(2)}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'lowercase',
            color: 'var(--ink-2)',
            background: 'var(--paper-0)',
            border: '1px solid var(--rule)',
            borderRadius: 999,
            padding: '3px 10px',
          }}
        >
          {idea.status}
        </span>
        {onStatus && idea.status === 'open' && (
          <>
            <button type="button" className="sb-idea-act" onClick={(e) => { e.stopPropagation(); onStatus('accepted'); }}>Accept</button>
            <button type="button" className="sb-idea-act" onClick={(e) => { e.stopPropagation(); onStatus('rejected'); }}>Reject</button>
            <button type="button" className="sb-idea-act" onClick={(e) => { e.stopPropagation(); onStatus('deferred'); }}>Defer</button>
          </>
        )}
      </div>
      <style>{`
        .sb-idea-act {
          font-family: var(--font-ui);
          font-size: 11px;
          font-weight: 500;
          padding: 5px 10px;
          border-radius: var(--r-md);
          border: 1px solid var(--rule);
          background: var(--paper-0);
          color: var(--ink-2);
          cursor: pointer;
        }
        .sb-idea-act:hover { color: var(--ink); border-color: var(--ink-3); }
      `}</style>
    </article>
  );
}
