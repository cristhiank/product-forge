import { useRef, useEffect, useState } from 'react';
import { X, Send, StopCircle, Copy, Check, MessageCircle, RotateCcw } from 'lucide-react';
import { useAIChat } from '@/hooks/use-ai-chat';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { cn } from '@/lib/utils';

const SCOPE_LABELS: Record<string, string> = {
  feature: 'Feature',
  doc: 'Doc',
  product: 'Product',
};

const SCOPE_PLACEHOLDERS: Record<string, string> = {
  feature: 'Ask about this feature...',
  doc: 'Ask about this document...',
  product: 'Ask about your product...',
};

const SCOPE_HINTS: Record<string, string> = {
  feature:
    'Ask me about this feature spec — I can analyze gaps, suggest improvements, or draft sections.',
  doc: 'Ask me about this document — I can help refine content, check consistency, or suggest improvements.',
  product:
    'Ask me anything about your product — I can explore features, docs, strategy, and health data.',
};

const SCOPE_BADGE: Record<string, string> = {
  feature: 'bg-blue-500/20 text-blue-400',
  doc: 'bg-purple-500/20 text-purple-400',
  product: 'bg-green-500/20 text-green-400',
};

export interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
  scope: 'product' | 'feature' | 'doc';
  contextId?: string;
  docContent?: string;
  onInsert?: (content: string) => void;
}

export function AIChatPanel({
  open,
  onClose,
  scope,
  contextId,
  docContent,
  onInsert,
}: AIChatPanelProps) {
  const { messages, streaming, error, send, abort, reset } = useAIChat({
    scope,
    contextId,
    docContent,
  });
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages update or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // Escape key closes panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-resize textarea (1–3 rows)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  }, [input]);

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const msg = input.trim();
    setInput('');
    await send(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed right-0 top-12 bottom-8 z-30 w-full sm:w-96 flex flex-col bg-card border-l border-border shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground flex-1">🤖 AI Chat</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            SCOPE_BADGE[scope] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {SCOPE_LABELS[scope]}
        </span>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2 gap-3">
            <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/70 leading-relaxed">
              {SCOPE_HINTS[scope]}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}
          >
            {/* Tool call indicators */}
            {msg.role === 'assistant' &&
              (msg.toolCalls ?? []).map((tc, i) => (
                <div
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  🔧 {tc.name}
                </div>
              ))}

            {/* Message bubble */}
            <div
              className={cn(
                'rounded-xl px-3 py-2 max-w-full',
                msg.role === 'user'
                  ? 'bg-blue-500/10 text-sm text-foreground ml-8'
                  : 'bg-muted/30 text-sm w-full',
              )}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              ) : (
                <>
                  {msg.content ? (
                    <MarkdownViewer content={msg.content} size="sm" />
                  ) : (
                    <span className="text-muted-foreground text-xs italic">Thinking…</span>
                  )}
                  {/* Blinking cursor while this message streams */}
                  {streaming && idx === messages.length - 1 && (
                    <span className="inline-block h-4 w-0.5 bg-primary/70 animate-pulse ml-0.5 align-middle" />
                  )}
                </>
              )}
            </div>

            {/* Action buttons on completed assistant messages */}
            {msg.role === 'assistant' &&
              msg.content &&
              (!streaming || idx < messages.length - 1) && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  {onInsert && (
                    <button
                      onClick={() => onInsert(msg.content)}
                      className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      Apply to doc
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="h-3 w-3 text-green-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              )}
          </div>
        ))}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={SCOPE_PLACEHOLDERS[scope]}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-60"
            style={{ maxHeight: '96px', overflowY: 'auto' }}
          />
          {streaming ? (
            <button
              onClick={abort}
              title="Stop"
              className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              title="Send"
              className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset chat
        </button>
      </div>
    </div>
  );
}
