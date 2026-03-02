import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface BacklogInfo {
  id: string;
  name: string;
  relativePath: string;
  itemCount?: number;
}

interface BacklogItem {
  id: string;
  title: string;
  kind?: string;
  priority?: string;
  folder?: string;
  tags?: string[];
  depends_on?: string[];
  related?: string[];
  body?: string;
  metadata?: Record<string, unknown>;
}

type Folder = "next" | "working" | "done" | "archive";

const FOLDERS: Folder[] = ["next", "working", "done", "archive"];

const FOLDER_LABELS: Record<Folder, string> = {
  next: "Next",
  working: "Working",
  done: "Done",
  archive: "Archive",
};

const FOLDER_ACCENT: Record<Folder, string> = {
  next: "border-t-blue-500",
  working: "border-t-yellow-500",
  done: "border-t-green-500",
  archive: "border-t-gray-500",
};

const FOLDER_BADGE: Record<Folder, string> = {
  next: "bg-blue-500/15 text-blue-400",
  working: "bg-yellow-500/15 text-yellow-400",
  done: "bg-green-500/15 text-green-400",
  archive: "bg-gray-500/15 text-gray-400",
};

const KIND_BADGE: Record<string, string> = {
  epic: "bg-blue-500/15 text-blue-400",
  task: "bg-gray-500/15 text-gray-400",
  bug: "bg-red-500/15 text-red-400",
  feature: "bg-green-500/15 text-green-400",
  chore: "bg-yellow-500/15 text-yellow-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-green-500/15 text-green-400",
};

// ── Badge helper ───────────────────────────────────────────

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ── Sortable Card ──────────────────────────────────────────

function SortableCard({ item }: { item: BacklogItem }) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/backlog/item/${item.id}`)}
      className={cn(
        "rounded-lg border border-border bg-background p-3 mb-2 cursor-grab active:cursor-grabbing transition-all hover:border-foreground/20",
        isDragging && "opacity-50 shadow-lg scale-[1.02]",
      )}
    >
      <CardContent item={item} />
    </div>
  );
}

function CardContent({ item }: { item: BacklogItem }) {
  return (
    <>
      <p className="font-mono text-[11px] text-muted-foreground mb-1">
        {item.id}
      </p>
      <p className="font-semibold text-sm leading-snug mb-2">{item.title}</p>
      <div className="flex flex-wrap gap-1">
        {item.kind && (
          <Badge
            label={item.kind}
            className={KIND_BADGE[item.kind] ?? "bg-gray-500/15 text-gray-400"}
          />
        )}
        {item.priority && (
          <Badge
            label={item.priority}
            className={
              PRIORITY_BADGE[item.priority] ?? "bg-gray-500/15 text-gray-400"
            }
          />
        )}
      </div>
    </>
  );
}

// ── Droppable Column ───────────────────────────────────────

function Column({
  folder,
  items,
  isOver,
}: {
  folder: Folder;
  items: BacklogItem[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: folder });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[250px] rounded-xl border border-border bg-card overflow-hidden border-t-2 flex flex-col transition-colors",
        FOLDER_ACCENT[folder],
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="font-semibold text-sm">{FOLDER_LABELS[folder]}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            FOLDER_BADGE[folder],
          )}
        >
          {items.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableCard key={item.id} item={item} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No items
          </p>
        )}
      </div>
    </div>
  );
}

// ── New Item Dialog ─────────────────────────────────────────

interface NewItemForm {
  kind: string;
  title: string;
  priority: string;
  description: string;
}

const EMPTY_FORM: NewItemForm = { kind: "", title: "", priority: "", description: "" };

function NewItemDialog({
  open,
  onClose,
  selectedBacklog,
}: {
  open: boolean;
  onClose: () => void;
  selectedBacklog: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewItemForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewItemForm, string>>>({});
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const createMutation = useMutation({
    mutationFn: (data: NewItemForm) =>
      api.post(`/api/backlog/items?backlog=${encodeURIComponent(selectedBacklog)}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog", selectedBacklog] });
      onClose();
    },
  });

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof NewItemForm, string>> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.kind) errs.kind = "Kind is required";
    if (!form.priority) errs.priority = "Priority is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      createMutation.mutate(form);
    },
    [validate, createMutation, form],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-foreground">New Backlog Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kind */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Kind</label>
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Select kind…</option>
              <option value="task">Task</option>
              <option value="story">Story</option>
              <option value="epic">Epic</option>
              <option value="bug">Bug</option>
            </select>
            {errors.kind && <p className="mt-1 text-xs text-red-400">{errors.kind}</p>}
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
            <input
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Item title…"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
          </div>

          {/* Priority */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Select priority…</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {errors.priority && <p className="mt-1 text-xs text-red-400">{errors.priority}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Optional description…"
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ── Page ───────────────────────────────────────────────────

export function BacklogPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Backlog picker
  const { data: backlogs = [] } = useQuery<BacklogInfo[]>({
    queryKey: ["backlogs"],
    queryFn: () => api.get<BacklogInfo[]>("/api/backlogs"),
  });

  const sortedBacklogs = useMemo(
    () => [...backlogs].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)),
    [backlogs],
  );

  const [selectedBacklog, setSelectedBacklog] = useState<string | null>(null);

  // Initialize selectedBacklog to first backlog once list loads
  useEffect(() => {
    if (sortedBacklogs.length > 0 && selectedBacklog === null) {
      const saved = localStorage.getItem("selectedBacklog");
      const valid = saved !== null && sortedBacklogs.some(b => b.id === saved);
      setSelectedBacklog(valid ? saved! : sortedBacklogs[0].id);
    }
  }, [sortedBacklogs, selectedBacklog]);

  // Persist selection to localStorage so BacklogItemPage can use it
  useEffect(() => {
    if (selectedBacklog !== null) {
      localStorage.setItem("selectedBacklog", selectedBacklog);
    }
  }, [selectedBacklog]);

  const backlogParam = selectedBacklog ?? "";

  const { data: items = [], isLoading } = useQuery<BacklogItem[]>({
    queryKey: ["backlog", backlogParam],
    queryFn: () => api.get<BacklogItem[]>(`/api/backlog/items?backlog=${encodeURIComponent(backlogParam)}`),
    enabled: selectedBacklog !== null,
  });

  const grouped = useMemo(() => {
    const map: Record<Folder, BacklogItem[]> = {
      next: [],
      working: [],
      done: [],
      archive: [],
    };
    for (const item of items) {
      const f = (item.folder ?? "next") as Folder;
      (map[f] ?? map.next).push(item);
    }
    return map;
  }, [items]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );

  const moveMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: Folder }) =>
      api.post(`/api/backlog/item/${id}/move?backlog=${encodeURIComponent(backlogParam)}`, { to }),
    onMutate: async ({ id, to }) => {
      await queryClient.cancelQueries({ queryKey: ["backlog", backlogParam] });
      const previous = queryClient.getQueryData<BacklogItem[]>(["backlog", backlogParam]);
      queryClient.setQueryData<BacklogItem[]>(["backlog", backlogParam], (old) =>
        old?.map((item) => (item.id === id ? { ...item, folder: to } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["backlog", backlogParam], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog", backlogParam] });
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: { over: { id: string | number } | null }) {
    setOverColumn(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!over) return;

    const itemId = String(active.id);
    const targetFolder = String(over.id) as Folder;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const currentFolder = (item.folder ?? "next") as Folder;
    if (FOLDERS.includes(targetFolder) && targetFolder !== currentFolder) {
      moveMutation.mutate({ id: itemId, to: targetFolder });
    }
  }

  if (isLoading && selectedBacklog !== null) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading backlog…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">📦 Backlog Board</h1>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Item
        </button>
      </div>

      {/* Backlog picker */}
      {sortedBacklogs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {sortedBacklogs.map((bl) => (
            <button
              key={bl.id}
              type="button"
              onClick={() => setSelectedBacklog(bl.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedBacklog === bl.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {bl.name}
              {bl.itemCount !== undefined && (
                <span className="opacity-75">({bl.itemCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      <NewItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        selectedBacklog={backlogParam}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto">
          {FOLDERS.map((folder) => (
            <Column
              key={folder}
              folder={folder}
              items={grouped[folder]}
              isOver={overColumn === folder}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="rounded-lg border border-border bg-background p-3 shadow-xl scale-[1.04] opacity-90 max-w-[300px]">
              <CardContent item={activeItem} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
