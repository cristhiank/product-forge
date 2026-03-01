import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import {
  Flame,
  FileText,
  Puzzle,
  Kanban,
  BarChart3,
  Bot,
  Plus,
  Cpu,
  Search,
} from "lucide-react";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

interface PaletteItem {
  label: string;
  to: string;
  icon: ComponentType<LucideProps>;
}

const pages: PaletteItem[] = [
  { label: "Dashboard", to: "/", icon: Flame },
  { label: "Product", to: "/product", icon: FileText },
  { label: "Features", to: "/product/features", icon: Puzzle },
  { label: "Backlog", to: "/backlog", icon: Kanban },
  { label: "Stats", to: "/backlog/stats", icon: BarChart3 },
  { label: "Agents", to: "/agents", icon: Bot },
];

const actions: PaletteItem[] = [
  { label: "Create item", to: "", icon: Plus },
  { label: "Spawn agent", to: "", icon: Cpu },
];

export function CommandPalette({
  externalOpen,
  onOpenChange,
}: {
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const isOpen = externalOpen ?? open;
  const setIsOpen = useCallback(
    (v: boolean) => {
      setOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (externalOpen !== undefined) setOpen(externalOpen);
  }, [externalOpen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setIsOpen]);

  const select = (item: PaletteItem) => {
    if (item.to) navigate(item.to);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* dialog */}
      <div
        className="relative mx-auto mt-[20vh] h-fit w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search…"
              className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group
              heading="Pages"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {pages.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => select(item)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent/30"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border" />

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {actions.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => select(item)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground data-[selected=true]:bg-accent/30 data-[selected=true]:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
