import { useEffect, useRef } from "react";
import {
  Sparkles,
  X,
  Loader2,
  Copy,
  Check,
  ClipboardList,
  Search,
  LayoutTemplate,
  ListTodo,
  StopCircle,
} from "lucide-react";
import { useAIStream } from "@/hooks/use-ai-stream";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { useState } from "react";

export interface AIAssistPanelProps {
  open: boolean;
  onClose: () => void;
  featureId: string;
  specContent: string;
  onInsert: (content: string) => void;
}

const ACTIONS = [
  {
    id: "acceptance_criteria",
    label: "Generate Acceptance Criteria",
    icon: ClipboardList,
    description: "Turn spec into testable AC",
  },
  {
    id: "gap_analysis",
    label: "Analyze for Gaps",
    icon: Search,
    description: "Find missing or unclear requirements",
  },
  {
    id: "mock_ui",
    label: "Generate Mock UI",
    icon: LayoutTemplate,
    description: "ASCII layout diagram from spec",
  },
  {
    id: "backlog_breakdown",
    label: "Create Backlog Items",
    icon: ListTodo,
    description: "Break spec into stories / tasks",
  },
] as const;

export function AIAssistPanel({
  open,
  onClose,
  featureId,
  specContent,
  onInsert,
}: AIAssistPanelProps) {
  const { content, streaming, error, run, abort, reset } = useAIStream();
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Scroll output to bottom as content streams in
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  // Reset output when panel closes
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Trap Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (streaming) abort();
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, streaming, abort, onClose]);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleInsert() {
    onInsert(content);
    onClose();
  }

  function handleAction(actionId: string) {
    reset();
    run({ action: actionId, featureId, specContent });
  }

  if (!open) return null;

  const hasOutput = content.length > 0 || error !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={() => !streaming && onClose()}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground flex-1">
            AI Assist
          </span>
          {streaming && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating…
            </span>
          )}
          <button
            onClick={onClose}
            disabled={streaming}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — split: actions top, output bottom */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Action buttons */}
          {!hasOutput && !streaming && (
            <div className="border-b border-border p-5 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Choose an action to run on this feature spec:
              </p>
              {ACTIONS.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  onClick={() => handleAction(id)}
                  disabled={!specContent.trim()}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-foreground/20 hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {description}
                    </p>
                  </div>
                </button>
              ))}
              {!specContent.trim() && (
                <p className="text-xs text-yellow-500/80 mt-2">
                  No spec content yet — write something first.
                </p>
              )}
            </div>
          )}

          {/* Streaming / output area */}
          {(hasOutput || streaming) && (
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                  {error}
                </div>
              ) : (
                <MarkdownViewer content={content} size="sm" />
              )}
              {streaming && !error && (
                <span className="inline-block h-4 w-0.5 bg-primary/70 animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-border px-5 py-4">
          {streaming ? (
            <>
              <button
                onClick={abort}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <StopCircle className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : hasOutput && !error ? (
            <>
              <button
                onClick={handleInsert}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Insert into spec
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={reset}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Try another
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </>
  );
}
