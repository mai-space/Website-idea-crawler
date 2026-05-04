import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { api } from '@/api/client';
import type { IdeaBriefRow, IdeaStatus, PaginatedIdeas } from '@/api/client';
import { useToastStore } from '@/store/toastStore';

const STATUSES: IdeaStatus[] = ['open', 'accepted', 'deferred', 'rejected', 'done'];

function KanbanCard({ idea }: { idea: IdeaBriefRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    opacity: isDragging ? 0.7 : 1,
    touchAction: 'none',
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'var(--paper-2)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r-md)',
        padding: 10,
        marginBottom: 8,
        cursor: 'grab',
      }}
      {...listeners}
      {...attributes}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{idea.title}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 6, textTransform: 'lowercase' }}>{idea.complexity} · impact {idea.impactScore.toFixed(2)}</div>
    </div>
  );
}

function KanbanColumn({ status, ideas, selected, onToggle }: {
  status: IdeaStatus;
  ideas: IdeaBriefRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 200,
        flex: '1 1 180px',
        background: isOver ? 'var(--paper-0)' : 'var(--paper-2)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--r-lg)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 420,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
        {status} ({ideas.length})
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {ideas.map((idea) => (
          <div key={idea.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={selected.has(idea.id)}
              onChange={() => onToggle(idea.id)}
              style={{ marginTop: 10 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <KanbanCard idea={idea} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IdeasKanbanBoard() {
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ['ideas', 'kanban'],
    queryFn: () => api.get<PaginatedIdeas>('/ideas', { params: { limit: 200, page: 1, sort: 'impact' } }).then((r) => r.data),
  });

  const grouped = useMemo(() => {
    const m = new Map<IdeaStatus, IdeaBriefRow[]>();
    STATUSES.forEach((s) => m.set(s, []));
    (data?.items ?? []).forEach((i) => {
      const list = m.get(i.status) ?? [];
      list.push(i);
      m.set(i.status, list);
    });
    return m;
  }, [data?.items]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IdeaStatus }) => api.patch(`/ideas/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ideas', 'kanban'] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
      pushToast('Brief updated', 'success');
    },
    onError: () => pushToast('Update failed', 'error'),
  });

  const bulk = useMutation({
    mutationFn: (status: IdeaStatus) =>
      api.post('/ideas/bulk', { ids: [...selected], status }).then((r) => r.data),
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['ideas', 'kanban'] });
      qc.invalidateQueries({ queryKey: ['ideas'] });
      pushToast('Bulk update applied', 'success');
    },
    onError: () => pushToast('Bulk update failed', 'error'),
  });

  const onDragEnd = (e: DragEndEvent) => {
    const ideaId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId || typeof overId !== 'string') return;
    if (!STATUSES.includes(overId as IdeaStatus)) return;
    const idea = data?.items.find((i) => i.id === ideaId);
    if (!idea || idea.status === overId) return;
    patchStatus.mutate({ id: ideaId, status: overId as IdeaStatus });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <section style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 'var(--r-lg)', padding: 16, boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          Ideas board
        </div>
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['accepted', 'deferred', 'rejected'] as const).map((st) => (
              <button
                key={st}
                type="button"
                disabled={bulk.isPending}
                onClick={() => bulk.mutate(st)}
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--rule)',
                  background: 'var(--paper-0)',
                  cursor: 'pointer',
                  textTransform: 'lowercase',
                }}
              >
                Set {st} ({selected.size})
              </button>
            ))}
          </div>
        )}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {STATUSES.map((st) => (
            <KanbanColumn key={st} status={st} ideas={grouped.get(st) ?? []} selected={selected} onToggle={toggle} />
          ))}
        </div>
      </DndContext>
      <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 10, marginBottom: 0 }}>
        Drag a card to another column to change status. Select multiple cards for bulk actions.
      </p>
    </section>
  );
}
