import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, RotateCcw, ChevronLeft } from "lucide-react";
import { MarkdownViewer } from "@/components/MarkdownViewer";

interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

interface GitDiff {
  fromSha: string;
  toSha: string;
  patch: string;
  additions: number;
  deletions: number;
}

type PanelView = "list" | "version" | "diff";

export interface GitHistoryPanelProps {
  filePath: string;
  open: boolean;
  onClose: () => void;
  onRevert?: (sha: string) => void;
}

function DiffViewer({
  patch,
  additions,
  deletions,
}: Pick<GitDiff, "patch" | "additions" | "deletions">) {
  const lines = patch.split("\n");
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-mono bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
          +{additions}
        </span>
        <span className="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-0.5 rounded">
          -{deletions}
        </span>
      </div>
      <pre className="text-xs font-mono overflow-auto rounded-lg border border-border bg-[oklch(0.12_0.02_250)] p-3 max-h-[400px]">
        {lines.map((line, i) => {
          let cls = "text-foreground/80 block";
          if (line.startsWith("+")) cls = "bg-green-500/10 text-green-400 block";
          else if (line.startsWith("-")) cls = "bg-red-500/10 text-red-400 block";
          else if (line.startsWith("@@"))
            cls = "bg-blue-500/10 text-blue-400 block";
          return (
            <span key={i} className={cls}>
              {line || " "}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

export function GitHistoryPanel({
  filePath,
  open,
  onClose,
  onRevert,
}: GitHistoryPanelProps) {
  const [view, setView] = useState<PanelView>("list");
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [revertConfirm, setRevertConfirm] = useState<string | null>(null);

  const { data: commits, isLoading } = useQuery<GitCommit[]>({
    queryKey: ["git", "history", filePath],
    queryFn: () =>
      api.get<GitCommit[]>(
        `/api/git/history?file=${encodeURIComponent(filePath)}&limit=20`,
      ),
    enabled: open && !!filePath,
  });

  const { data: versionData, isLoading: versionLoading } = useQuery<{
    content: string;
  }>({
    queryKey: ["git", "show", filePath, selectedCommit?.sha],
    queryFn: () =>
      api.get<{ content: string }>(
        `/api/git/show?file=${encodeURIComponent(filePath)}&commit=${selectedCommit!.sha}`,
      ),
    enabled: view === "version" && !!selectedCommit,
  });

  const { data: diffData, isLoading: diffLoading } = useQuery<GitDiff>({
    queryKey: ["git", "diff", filePath, selectedCommit?.sha],
    queryFn: () =>
      api.get<GitDiff>(
        `/api/git/diff?file=${encodeURIComponent(filePath)}&from=${selectedCommit!.sha}`,
      ),
    enabled: view === "diff" && !!selectedCommit,
  });

  const filename = filePath.split("/").pop() ?? filePath;

  if (!open) return null;

  function handleView(commit: GitCommit) {
    setSelectedCommit(commit);
    setView("version");
  }

  function handleCompare(commit: GitCommit) {
    setSelectedCommit(commit);
    setView("diff");
  }

  function handleBack() {
    setView("list");
    setSelectedCommit(null);
  }

  function handleRevert(sha: string) {
    if (revertConfirm === sha) {
      onRevert?.(sha);
      setRevertConfirm(null);
    } else {
      setRevertConfirm(sha);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col bg-[oklch(0.13_0.02_250)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-1.5">
            {view !== "list" && (
              <button
                onClick={handleBack}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back to list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <span className="font-medium text-sm">
              📜 History —{" "}
              <span className="font-mono text-muted-foreground">{filename}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {/* Commit list */}
          {view === "list" && (
            <>
              {isLoading && (
                <div className="text-muted-foreground text-sm">
                  Loading history…
                </div>
              )}
              {!isLoading && (!commits || commits.length === 0) && (
                <div className="text-muted-foreground text-sm">
                  No history found for this file.
                </div>
              )}
              <ul className="space-y-2">
                {commits?.map((commit) => (
                  <li
                    key={commit.sha}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          className="font-mono text-xs text-primary hover:underline"
                          onClick={() => handleView(commit)}
                        >
                          {commit.shortSha}
                        </button>
                        <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                          {commit.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {commit.author} · {commit.relativeDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        onClick={() => handleView(commit)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleCompare(commit)}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Compare
                      </button>
                      {onRevert &&
                        (revertConfirm === commit.sha ? (
                          <span className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-orange-400">
                              Sure?
                            </span>
                            <button
                              onClick={() => handleRevert(commit.sha)}
                              className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 transition-colors"
                            >
                              Yes, revert
                            </button>
                            <button
                              onClick={() => setRevertConfirm(null)}
                              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRevert(commit.sha)}
                            className="ml-auto text-xs px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Revert
                          </button>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Version viewer */}
          {view === "version" && selectedCommit && (
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-400">
                Viewing version from {selectedCommit.relativeDate} —{" "}
                <span className="font-mono">{selectedCommit.shortSha}</span>:{" "}
                {selectedCommit.message}
              </div>
              {versionLoading && (
                <div className="text-muted-foreground text-sm">Loading…</div>
              )}
              {versionData && (
                <MarkdownViewer content={versionData.content} />
              )}
            </div>
          )}

          {/* Diff viewer */}
          {view === "diff" && selectedCommit && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                Comparing{" "}
                <span className="font-mono text-foreground">
                  {selectedCommit.shortSha}
                </span>{" "}
                → current
              </div>
              {diffLoading && (
                <div className="text-muted-foreground text-sm">
                  Loading diff…
                </div>
              )}
              {diffData && (
                <DiffViewer
                  patch={diffData.patch}
                  additions={diffData.additions}
                  deletions={diffData.deletions}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
