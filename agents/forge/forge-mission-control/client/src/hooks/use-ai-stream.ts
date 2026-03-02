import { useState, useRef, useCallback } from 'react';

interface AIStreamState {
  content: string;
  streaming: boolean;
  error: string | null;
}

export function useAIStream() {
  const [state, setState] = useState<AIStreamState>({
    content: '',
    streaming: false,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (body: { action: string; featureId: string; specContent: string }) => {
      setState({ content: '', streaming: true, error: null });
      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/ai/feature-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          setState({ content: '', streaming: false, error: text });
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6)) as {
                type: string;
                content?: string;
                error?: string;
              };
              if (data.type === 'delta' && data.content) {
                setState((prev) => ({
                  ...prev,
                  content: prev.content + data.content,
                }));
              } else if (data.type === 'error') {
                setState((prev) => ({
                  ...prev,
                  error: data.error ?? 'Unknown error',
                  streaming: false,
                }));
              } else if (data.type === 'done') {
                setState((prev) => ({ ...prev, streaming: false }));
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }

        setState((prev) => ({ ...prev, streaming: false }));
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setState({ content: '', streaming: false, error: String(err) });
        }
      }
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, streaming: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ content: '', streaming: false, error: null });
  }, []);

  return { ...state, run, abort, reset };
}
