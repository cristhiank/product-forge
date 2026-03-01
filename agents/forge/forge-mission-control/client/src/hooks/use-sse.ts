import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const EVENT_TO_QUERY_KEY: Record<string, string[]> = {
  product_change: ["product"],
  backlog_change: ["backlog"],
  worker_update: ["agents"],
};

const MAX_BACKOFF_MS = 30_000;

export function useSSE() {
  const queryClient = useQueryClient();
  const retryCount = useRef(0);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/events");

      es.onopen = () => {
        retryCount.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string };
          const queryKey = data.type ? EVENT_TO_QUERY_KEY[data.type] : undefined;
          if (queryKey) {
            queryClient.invalidateQueries({ queryKey });
          }
        } catch {
          // ignore unparseable messages
        }
      };

      es.onerror = () => {
        es?.close();
        const backoff = Math.min(
          1000 * 2 ** retryCount.current,
          MAX_BACKOFF_MS,
        );
        retryCount.current += 1;
        timer = setTimeout(connect, backoff);
      };
    }

    connect();

    return () => {
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);
}
