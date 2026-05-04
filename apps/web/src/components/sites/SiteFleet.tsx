import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Site } from '@/api/client';
import { SiteTile } from './SiteTile';
import { SiteDetailDrawer } from './SiteDetailDrawer';

function SkeletonTile() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--paper-0) 25%, var(--rule) 50%, var(--paper-0) 75%)',
    backgroundSize: '200% 100%',
    borderRadius: 6, animation: 'skeleton 1.4s ease-in-out infinite',
  };
  return (
    <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 18 }}>
      <div style={{ ...shimmer, height: 18, width: '60%', marginBottom: 8 }} />
      <div style={{ ...shimmer, height: 12, width: '40%', marginBottom: 20 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ ...shimmer, height: 40 }} />)}
      </div>
    </div>
  );
}

function AddSiteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [cms, setCms] = useState<'typo3' | 'wordpress' | 'generic'>('generic');

  const create = useMutation({
    mutationFn: () => api.post('/sites', { name, url, cms }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); onClose(); },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,23,26,0.36)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--paper-2)', borderRadius: 'var(--r-xl)', padding: 32, width: 440, boxShadow: 'var(--shadow-2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginBottom: 20 }}>Add site</h2>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ModalField label="Name" value={name} onChange={setName} placeholder="Acme Corp" />
          <ModalField label="URL" value={url} onChange={setUrl} placeholder="https://example.com" type="url" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>CMS</span>
            <select value={cms} onChange={(e) => setCms(e.target.value as typeof cms)}
              style={{ background: 'var(--paper-0)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', appearance: 'none' }}>
              <option value="generic">Generic</option>
              <option value="typo3">TYPO3</option>
              <option value="wordpress">WordPress</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ background: 'var(--paper-0)', color: 'var(--ink-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', padding: '9px 16px', fontSize: 13, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={create.isPending} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '9px 16px', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              {create.isPending ? 'Adding…' : 'Add site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required
        style={{ background: 'var(--paper-0)', border: '1px solid var(--rule)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-ui)', color: 'var(--ink)', outline: 'none' }} />
    </label>
  );
}

export function SiteFleet() {
  const [showAdd, setShowAdd] = useState(false);
  const [detailSiteId, setDetailSiteId] = useState<string | null>(null);

  const { data: sites, isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then((r) => r.data),
    refetchInterval: 10_000,
  });

  return (
    <section>
      <style>{`@keyframes skeleton { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>Site fleet</h2>
          {sites && <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{sites.length} site{sites.length !== 1 ? 's' : ''}</p>}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', padding: '9px 16px', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add site
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map((i) => <SkeletonTile key={i} />)}
        </div>
      ) : !sites?.length ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No sites yet.</div>
          <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-ui)', textDecoration: 'underline' }}>
            Add one to start crawling.
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {sites.map((site) => (
            <SiteTile key={site.id} site={site} onOpenDetail={setDetailSiteId} />
          ))}
        </div>
      )}

      {showAdd && <AddSiteModal onClose={() => setShowAdd(false)} />}
      <SiteDetailDrawer siteId={detailSiteId} onClose={() => setDetailSiteId(null)} />
    </section>
  );
}
