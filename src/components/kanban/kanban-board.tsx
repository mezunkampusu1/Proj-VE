"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Check, X, Search, Tag as TagIcon } from "lucide-react";
import { TaskCard } from "@/components/kanban/task-card";
import { TaskModal } from "@/components/kanban/task-modal";
import { AiGenerateTasksModal } from "@/components/kanban/ai-generate-tasks-modal";
import { DayNavigator } from "@/components/announcements/day-navigator";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { TagBadge } from "@/components/tags/tag-badge";
import { cn } from "@/lib/utils";
import type { ColumnItem, TagItem, TaskWithRelations, TeamMemberOption } from "@/components/kanban/types";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Revizyon: "hepsi mavi kayıyor ... her birine otomatik renk ver" — sütun
// sürükle-bırak vurgusu önceden hep tek bir primary/mavi tondaydı, hangi
// sütuna bırakıldığı görsel olarak ayırt edilemiyordu. Her sütuna sırasına
// göre (index % 5) mevcut tema tint token'larından otomatik, birbirinden
// farklı bir renk atanır — hem sürükleme vurgusunda hem de başlığın
// yanındaki kalıcı küçük noktada kullanılır, elle renk seçmeye gerek yok.
const COLUMN_TONES = [
  { dot: "bg-tint-blue-foreground", ring: "ring-tint-blue-foreground/40", bg: "bg-tint-blue" },
  { dot: "bg-tint-green-foreground", ring: "ring-tint-green-foreground/40", bg: "bg-tint-green" },
  { dot: "bg-tint-violet-foreground", ring: "ring-tint-violet-foreground/40", bg: "bg-tint-violet" },
  { dot: "bg-tint-amber-foreground", ring: "ring-tint-amber-foreground/40", bg: "bg-tint-amber" },
  { dot: "bg-tint-red-foreground", ring: "ring-tint-red-foreground/40", bg: "bg-tint-red" },
] as const;

function columnTone(index: number) {
  return COLUMN_TONES[index % COLUMN_TONES.length];
}

export function KanbanBoard({
  projectId,
  projectKind,
  initialTasks,
  initialColumns,
  members,
}: {
  projectId: string;
  projectKind: "DATED" | "FIXED";
  initialTasks: TaskWithRelations[];
  initialColumns: ColumnItem[];
  members: TeamMemberOption[];
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [tasks, setTasks] = useState(initialTasks);
  const [columns, setColumns] = useState(initialColumns);
  const [loading, setLoading] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [confirmDeleteColumnId, setConfirmDeleteColumnId] = useState<string | null>(null);
  const [columnError, setColumnError] = useState<string | null>(null);
  const isFirstLoad = useRef(true);

  // Etiket arama/filtreleme (bkz. görev #195: "bu etiketleri arayabileceğimiz
  // birşey yap"). Tüm çalışma alanı etiketleri bir kez çekilir; kullanıcı
  // aramada yazdıkça öneriler daralır, tıklayarak seçtiği etiketler panoyu
  // (OR mantığıyla — seçili etiketlerden en az biri olan görevler) filtreler.
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => setAllTags(data.tags ?? []))
      .catch(() => {});
  }, []);

  const matchingTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    return allTags.filter((t) => (q === "" ? true : t.name.toLowerCase().includes(q)));
  }, [allTags, tagQuery]);

  const visibleTasks = useMemo(() => {
    if (selectedTagIds.length === 0) return tasks;
    return tasks.filter((t) => t.tags.some((tag) => selectedTagIds.includes(tag.id)));
  }, [tasks, selectedTagIds]);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  const loadTasks = useCallback(
    async (date: string) => {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/tasks?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
      setLoading(false);
    },
    [projectId],
  );

  const loadColumns = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/columns`);
    if (res.ok) {
      const data = await res.json();
      setColumns(data.columns);
    }
  }, [projectId]);

  useEffect(() => {
    if (isFirstLoad.current) {
      // İlk render'da sunucudan gelen initialTasks zaten "bugün" için — tekrar
      // fetch etmeye gerek yok.
      isFirstLoad.current = false;
      return;
    }
    loadTasks(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Kullanıcı talebi #7/#9: "liste ekleyince karşı taraftaki kişiye f5
  // çekmeden gelmiyor" / "görevi yer değiştirdiğimde... karşı taraf f5
  // çekmek zorunda kalıyor". Uygulamada genel bir WebSocket altyapısı yok
  // (yalnızca Ortak Alan'ın Yjs/Hocuspocus'u var) — bildirim merkezindeki
  // aynı yoklama (polling) deseni burada da kullanılıyor: yeni görev,
  // sürükle-bırak ile sütun/durum değişikliği, atama/etiket güncellemesi
  // gibi başka bir kullanıcının yaptığı her değişiklik en geç birkaç
  // saniyede panoya yansır. Kendi sürükle-bırak işlemimiz sırasında (drag
  // devam ederken) araya girmemesi için `dragTaskId` boşken çalışır.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!dragTaskId) loadTasks(selectedDate);
    }, 5000);
    function onVisible() {
      if (document.visibilityState === "visible" && !dragTaskId) loadTasks(selectedDate);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, dragTaskId]);

  const refresh = useCallback(async () => {
    await Promise.all([loadTasks(selectedDate), loadColumns()]);
    router.refresh();
  }, [loadTasks, loadColumns, selectedDate, router]);

  function openCreate(columnId: string) {
    setActiveTaskId(null);
    setCreateColumnId(columnId);
    setTaskModalOpen(true);
  }

  function openEdit(taskId: string) {
    setActiveTaskId(taskId);
    setCreateColumnId(null);
    setTaskModalOpen(true);
  }

  async function persistOrder(columnId: string, taskIds: string[]) {
    await fetch(`/api/tasks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId, taskIds }),
    });
    router.refresh();
  }

  function handleDrop(targetColumnId: string, targetTaskId: string | null) {
    if (!dragTaskId) return;
    const dragged = tasks.find((t) => t.id === dragTaskId);
    if (!dragged) return;

    setTasks((prev) => {
      const withoutDragged = prev.filter((t) => t.id !== dragTaskId);
      const columnTasks = withoutDragged
        .filter((t) => t.columnId === targetColumnId)
        .sort((a, b) => a.position - b.position);
      const otherTasks = withoutDragged.filter((t) => t.columnId !== targetColumnId);

      const insertAt = targetTaskId
        ? columnTasks.findIndex((t) => t.id === targetTaskId)
        : columnTasks.length;
      const nextColumnTasks = [...columnTasks];
      nextColumnTasks.splice(insertAt === -1 ? columnTasks.length : insertAt, 0, {
        ...dragged,
        columnId: targetColumnId,
      });

      const reindexed = nextColumnTasks.map((t, i) => ({ ...t, position: i }));
      persistOrder(
        targetColumnId,
        reindexed.map((t) => t.id),
      );

      return [...otherTasks, ...reindexed];
    });

    setDragTaskId(null);
    setDragOverTaskId(null);
  }

  async function addColumn() {
    if (!newColumnName.trim()) return;
    setColumnError(null);
    const res = await fetch(`/api/projects/${projectId}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColumnName.trim() }),
    });
    if (res.ok) {
      setNewColumnName("");
      setAddingColumn(false);
      loadColumns();
    } else {
      const data = await res.json().catch(() => null);
      setColumnError(data?.error ?? "Sütun eklenemedi.");
    }
  }

  async function renameColumn(columnId: string) {
    if (!editingColumnName.trim()) return;
    setColumns((cols) =>
      cols.map((c) => (c.id === columnId ? { ...c, name: editingColumnName.trim() } : c)),
    );
    await fetch(`/api/projects/${projectId}/columns/${columnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingColumnName.trim() }),
    });
    setEditingColumnId(null);
  }

  async function deleteColumn(columnId: string) {
    setColumnError(null);
    const res = await fetch(`/api/projects/${projectId}/columns/${columnId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      loadColumns();
    } else {
      const data = await res.json().catch(() => null);
      setColumnError(data?.error ?? "Sütun silinemedi.");
    }
    setConfirmDeleteColumnId(null);
  }

  async function moveColumn(columnId: string, direction: -1 | 1) {
    const sorted = [...columns].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((c) => c.id === columnId);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    [sorted[index], sorted[swapWith]] = [sorted[swapWith], sorted[index]];
    setColumns(sorted.map((c, i) => ({ ...c, order: i })));
    await fetch(`/api/projects/${projectId}/columns/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnIds: sorted.map((c) => c.id) }),
    });
  }

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {projectKind === "DATED" ? (
          <DayNavigator
            value={selectedDate}
            onChange={setSelectedDate}
            count={visibleTasks.length}
            countLabel="görev"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{visibleTasks.length} görev</p>
        )}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setTagFilterOpen((o) => !o)}
            className={cn(selectedTagIds.length > 0 && "border-primary/50 text-primary")}
          >
            <TagIcon className="h-4 w-4" />
            Etiketle Filtrele
            {selectedTagIds.length > 0 && ` (${selectedTagIds.length})`}
          </Button>
          <Button variant="secondary" onClick={() => setAiModalOpen(true)}>
            AI ile Görev Oluştur
          </Button>
        </div>
      </div>

      {tagFilterOpen && (
        <div className="mb-4 space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Etiket ara..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {matchingTags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button key={tag.id} type="button" onClick={() => toggleTagFilter(tag.id)}>
                  <TagBadge
                    name={tag.name}
                    color={tag.color}
                    className={cn(
                      "cursor-pointer transition-opacity",
                      !active && "opacity-50 hover:opacity-80",
                      active && "ring-1 ring-offset-1 ring-offset-background",
                    )}
                  />
                </button>
              );
            })}
            {matchingTags.length === 0 && (
              <span className="text-xs text-muted-foreground">Eşleşen etiket yok.</span>
            )}
            {selectedTagIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTagIds([])}
                className="ml-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Filtreyi temizle
              </button>
            )}
          </div>
        </div>
      )}

      {columnError && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {columnError}
        </p>
      )}

      <div key={selectedDate} className="animate-board-in flex items-start gap-4 overflow-x-auto pb-2">
        {sortedColumns.map((column, colIndex) => {
          const columnTasks = visibleTasks
            .filter((t) => t.columnId === column.id)
            .sort((a, b) => a.position - b.position);
          const tone = columnTone(colIndex);

          return (
            <div
              key={column.id}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setDragOverColumnId(column.id)}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(column.id, dragOverTaskId);
                setDragOverColumnId(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl bg-secondary/40 p-3 transition-colors duration-150",
                dragTaskId && dragOverColumnId === column.id && cn(tone.bg, "ring-1", tone.ring),
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-1 px-1">
                {editingColumnId === column.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <Input
                      autoFocus
                      value={editingColumnName}
                      onChange={(e) => setEditingColumnName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameColumn(column.id);
                        if (e.key === "Escape") setEditingColumnId(null);
                      }}
                      className="h-7 text-sm"
                    />
                    <button
                      onClick={() => renameColumn(column.id)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Kaydet"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingColumnId(null)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label="Vazgeç"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
                      <span className="truncate">{column.name}</span>
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {columnTasks.length}
                      </span>
                    </h3>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => moveColumn(column.id, -1)}
                        disabled={colIndex === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        aria-label="Sütunu sola taşı"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveColumn(column.id, 1)}
                        disabled={colIndex === sortedColumns.length - 1}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                        aria-label="Sütunu sağa taşı"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingColumnId(column.id);
                          setEditingColumnName(column.name);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Sütunu yeniden adlandır"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteColumnId(column.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label="Sütunu sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openCreate(column.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Görev ekle"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Revizyon: "100lerce görev olacak, aşağı kaymasın" — sütun
                  artık sonsuza kadar uzamıyor; görev listesi kendi içinde
                  sabit bir yükseklikte kayıyor (yaklaşık 6 kart görünür),
                  pano/sayfa boyu görev sayısından etkilenmiyor. */}
              <div className="flex-1 space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: "min(65vh, 640px)" }}>
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={dragTaskId === task.id}
                    isDragOver={dragTaskId !== null && dragTaskId !== task.id && dragOverTaskId === task.id}
                    onClick={() => openEdit(task.id)}
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnter={() => setDragOverTaskId(task.id)}
                    onDragEnd={() => {
                      setDragTaskId(null);
                      setDragOverTaskId(null);
                      setDragOverColumnId(null);
                    }}
                  />
                ))}
                {columnTasks.length === 0 && !loading && (
                  <p className="px-1 py-2 text-xs text-muted-foreground">Görev yok</p>
                )}
              </div>
            </div>
          );
        })}

        <div className="w-72 shrink-0">
          {addingColumn ? (
            <div className="flex items-center gap-1 rounded-xl bg-secondary/40 p-3">
              <Input
                autoFocus
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Sütun adı"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addColumn();
                  if (e.key === "Escape") setAddingColumn(false);
                }}
                className="h-8 text-sm"
              />
              <button
                onClick={addColumn}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Sütunu ekle"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAddingColumn(false)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Vazgeç"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
              )}
            >
              <Plus className="h-4 w-4" />
              Sütun Ekle
            </button>
          )}
        </div>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onSaved={refresh}
        projectId={projectId}
        projectKind={projectKind}
        taskId={activeTaskId}
        members={members}
        columns={sortedColumns}
        defaultColumnId={createColumnId ?? sortedColumns[0]?.id ?? ""}
        defaultScheduledDate={selectedDate}
      />

      <AiGenerateTasksModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onCreated={refresh}
        projectId={projectId}
        scheduledDate={selectedDate}
      />

      <ConfirmDialog
        open={!!confirmDeleteColumnId}
        onOpenChange={(open) => !open && setConfirmDeleteColumnId(null)}
        description="Bu sütunu silmek istediğinize emin misiniz?"
        onConfirm={() => confirmDeleteColumnId && deleteColumn(confirmDeleteColumnId)}
      />
    </div>
  );
}
