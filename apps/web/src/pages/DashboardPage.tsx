import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SiteFleet } from '@/components/sites/SiteFleet';
import { QueueMonitor } from '@/components/queue/QueueMonitor';

export function DashboardPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Overview" subtitle="Multi-site intelligence dashboard" />

        <main style={{ flex: 1, padding: 32, maxWidth: 1440, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32, alignItems: 'start' }}>
            <SiteFleet />

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 32 }}>
              <QueueMonitor />

              <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--shadow-1)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Phase 2</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Parse queue, embeddings, and the site detail drawer are live. Idea generation follows in Phase 3.
                </p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
