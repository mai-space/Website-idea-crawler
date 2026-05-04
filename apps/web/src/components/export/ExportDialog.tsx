import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { api } from '@/api/client';
import type { IdeaDetail, PaginatedIdeas } from '@/api/client';
import { useToastStore } from '@/store/toastStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: Props) {
  const pushToast = useToastStore((s) => s.pushToast);
  const [format, setFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const download = (name: string, mime: string, body: string) => {
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const run = async () => {
    setBusy(true);
    try {
      if (format === 'json') {
        const { data } = await api.get<unknown[]>('/export', { params: { format: 'json', limit: 500 } });
        download('sitebrief-ideas.json', 'application/json', JSON.stringify(data, null, 2));
        pushToast('JSON export downloaded', 'success');
      } else if (format === 'csv') {
        const { data } = await api.get<{ content: string }>('/export', { params: { format: 'csv', limit: 500 } });
        download('sitebrief-ideas.csv', 'text/csv', data.content);
        pushToast('CSV export downloaded', 'success');
      } else {
        const list = await api.get<PaginatedIdeas>('/ideas', { params: { limit: 40, page: 1, sort: 'impact' } }).then((r) => r.data);
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        let y = 48;
        doc.setFontSize(14);
        doc.text('Sitebrief — pitch briefs', 40, y);
        y += 28;
        doc.setFontSize(10);
        for (const row of list.items) {
          let detail: IdeaDetail | null = null;
          try {
            detail = await api.get<IdeaDetail>(`/ideas/${row.id}`).then((r) => r.data);
          } catch {
            detail = null;
          }
          const block = detail
            ? `${detail.title}\n${detail.pitchText}\nHours: ${detail.displayHours} · ${detail.status}\n`
            : `${row.title}\n${row.pitchText}\n`;
          const lines = doc.splitTextToSize(block, 515);
          if (y + lines.length * 12 > 780) {
            doc.addPage();
            y = 48;
          }
          doc.text(lines, 40, y);
          y += lines.length * 12 + 16;
        }
        doc.save('sitebrief-briefs.pdf');
        pushToast('PDF generated (first pages)', 'success');
      }
      onClose();
    } catch {
      pushToast('Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(21,23,26,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        style={{ width: 'min(420px,100%)', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 22, boxShadow: 'var(--shadow-2)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 16px' }}>Export briefs</h2>
        <label style={{ display: 'block', marginBottom: 12, fontSize: 13, color: 'var(--ink-2)' }}>
          Format
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--paper-0)' }}
          >
            <option value="json">JSON (org-wide, up to 500)</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF (first 40 briefs, client-side)</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--rule)', background: 'var(--paper-0)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void run()} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Working…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
