import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SiteFleet } from '@/components/sites/SiteFleet';
import { QueueMonitor } from '@/components/queue/QueueMonitor';
import { IdeasPanel } from '@/components/ideas/IdeasPanel';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ErrorConsole } from '@/components/dashboard/ErrorConsole';
import { IdeasKanbanBoard } from '@/components/ideas/IdeasKanbanBoard';
import { ExportDialog } from '@/components/export/ExportDialog';
import { CommandPalette, type CommandAction } from '@/components/layout/CommandPalette';
import { Toaster } from '@/components/ui/Toaster';
import { api } from '@/api/client';
import type { IdeaOrgStats } from '@/api/client';

export function DashboardPage() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['ideas', 'stats'],
    queryFn: () => api.get<IdeaOrgStats>('/ideas/stats').then((r) => r.data),
    refetchInterval: 45_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands = useMemo<CommandAction[]>(
    () => [
      { id: 'export', label: 'Export briefs (JSON / CSV / PDF)…', run: () => setExportOpen(true) },
      { id: 'close', label: 'Close palette', run: () => setCmdOpen(false) },
    ],
    [],
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--paper)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar title="Overview" subtitle="Multi-site intelligence dashboard" />

        <main style={{ flex: 1, padding: 32, maxWidth: 1440, width: '100%' }}>
          {stats && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 24,
                fontSize: 12,
                color: 'var(--ink-2)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>briefs {stats.total}</span>
              <span>open high-impact {stats.openHighImpact}</span>
              <span style={{ textTransform: 'lowercase' }}>
                open {stats.byStatus?.open ?? 0} · accepted {stats.byStatus?.accepted ?? 0}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <SiteFleet />
              <IdeasKanbanBoard />
              <IdeasPanel />
              <ActivityFeed />
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 32 }}>
              <QueueMonitor />
              <ErrorConsole />
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: 'var(--paper-0)',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  color: 'var(--ink-2)',
                }}
              >
                Export briefs…
              </button>

              <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 20, boxShadow: 'var(--shadow-1)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12 }}>Phase 4–5</div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Exports, org stats, virtualised activity, error console with re-queue, Kanban + bulk, manual hours, toasts, command palette (⌘K), and scheduled crawls with content-hash change detection.
                </p>
              </div>
            </aside>
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} actions={commands} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <Toaster />
    </div>
  );
}
