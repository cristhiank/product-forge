import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

// ── Page ───────────────────────────────────────────────────

export function BacklogPage() {
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { data: items = [], isLoading } = useQuery<BacklogItem[]>({
    queryKey: ["backlog"],
    queryFn: () => api.get<BacklogItem[]>("/api/backlog/items?all=true"),
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
      api.post(`/api/backlog/item/${id}/move`, { to }),
    onMutate: async ({ id, to }) => {
      await queryClient.cancelQueries({ queryKey: ["backlog"] });
      const previous = queryClient.getQueryData<BacklogItem[]>(["backlog"]);
      queryClient.setQueryData<BacklogItem[]>(["backlog"], (old) =>
        old?.map((item) => (item.id === id ? { ...item, folder: to } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["backlog"], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["backlog"] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading backlog…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold mb-4">📦 Backlog Board</h1>
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
