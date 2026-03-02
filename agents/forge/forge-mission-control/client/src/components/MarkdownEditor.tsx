import { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

export interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

export function MarkdownEditor({
  content,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const savedOnSave = useRef(onSave);
  savedOnSave.current = onSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        savedOnSave.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile tab toggle */}
      <div className="flex sm:hidden gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            activeTab === "edit"
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("edit")}
        >
          Edit
        </button>
        <button
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            activeTab === "preview"
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
      </div>

      {/* Split pane */}
      <div
        className="flex border border-border rounded-xl overflow-hidden"
        style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}
      >
        {/* Editor pane */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            activeTab === "preview" ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="shrink-0 px-3 py-1.5 border-b border-border bg-[oklch(0.16_0.02_250)] text-xs text-muted-foreground">
            Markdown
          </div>
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 w-full resize-none bg-[oklch(0.14_0.02_250)] font-mono text-sm text-foreground p-4 outline-none leading-relaxed"
            spellCheck={false}
          />
        </div>

        {/* Divider */}
        <div className="hidden sm:block shrink-0 w-px bg-border" />

        {/* Preview pane */}
        <div
          className={`flex-1 flex flex-col min-w-0 overflow-auto ${
            activeTab === "edit" ? "hidden sm:flex" : "flex"
          }`}
        >
          <div className="shrink-0 px-3 py-1.5 border-b border-border bg-[oklch(0.16_0.02_250)] text-xs text-muted-foreground">
            Preview
          </div>
          <div className="flex-1 overflow-auto p-4">
            <MarkdownViewer content={content} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
          Ctrl+S / ⌘S to save
        </span>
      </div>
    </div>
  );
}
