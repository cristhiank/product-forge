import { useState, useRef, useCallback, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: { name: string; args: unknown }[];
}

export interface UseAIChatOptions {
  scope: 'product' | 'feature' | 'doc';
  contextId?: string;
  docContent?: string;
}

export interface UseAIChatReturn {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  sessionId: string | null;
  send: (message: string) => Promise<void>;
  abort: () => void;
  reset: () => void;
  initialized: boolean;
}

export function useAIChat({ scope, contextId, docContent }: UseAIChatOptions): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Keep opts in a ref so send() stays stable across docContent edits
  const optsRef = useRef({ scope, contextId, docContent });
  useEffect(() => {
    optsRef.current = { scope, contextId, docContent };
  }, [scope, contextId, docContent]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const send = useCallback(async (message: string) => {
    if (!message.trim() || streaming) return;
    setError(null);

    // Lazily create session on first send
    let sid = sessionIdRef.current;
    if (!sid) {
      try {
        const res = await fetch('/api/ai/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: optsRef.current.scope,
            contextId: optsRef.current.contextId,
            docContent: optsRef.current.docContent,
          }),
        });
        if (!res.ok) {
          setError(await res.text());
          return;
        }
        const data = (await res.json()) as { sessionId: string };
        sid = data.sessionId;
        sessionIdRef.current = sid;
        setSessionId(sid);
        setInitialized(true);
      } catch (err) {
        setError(String(err));
        return;
      }
    }

    // Append user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Append streaming assistant placeholder
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), toolCalls: [] },
    ]);
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, message }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(await res.text());
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6)) as {
              type: string;
              content?: string;
              error?: string;
              toolName?: string;
              toolArgs?: unknown;
            };
            if (data.type === 'delta' && data.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + data.content! } : m,
                ),
              );
            } else if (data.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { name: data.toolName ?? 'tool', args: data.toolArgs },
                        ],
                      }
                    : m,
                ),
              );
            } else if (data.type === 'error') {
              setError(data.error ?? 'Unknown error');
              setStreaming(false);
            } else if (data.type === 'done') {
              setStreaming(false);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
      setStreaming(false);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(String(err));
      }
      setStreaming(false);
    }
  }, [streaming]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    const sid = sessionIdRef.current;
    if (sid) {
      fetch(`/api/ai/chat/sessions/${sid}`, { method: 'DELETE' }).catch(() => {});
      sessionIdRef.current = null;
      setSessionId(null);
    }
    setMessages([]);
    setStreaming(false);
    setError(null);
    setInitialized(false);
  }, []);

  // Destroy session on unmount
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (sid) {
        fetch(`/api/ai/chat/sessions/${sid}`, { method: 'DELETE' }).catch(() => {});
      }
    };
  }, []);

  return { messages, streaming, error, sessionId, send, abort, reset, initialized };
}
