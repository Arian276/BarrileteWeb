import { useEffect, useState } from "react";


export function useViewerCountList(streamId: string, intervalMs = 5000) {
  const [viewerCount, setViewerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    const fetchCount = async () => {
      try {
        const r = await fetch(`/api/streams/${encodeURIComponent(streamId)}`);
        if (r.ok) {
          const j = await r.json();
          setViewerCount(Number(j.viewers ?? 0));
        }
      } finally {
        setIsLoading(false);
        if (!stop) timer = setTimeout(fetchCount, intervalMs);
      }
    };

    fetchCount();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [streamId, intervalMs]);

  return { viewerCount, isConnected: false, isLoading };
}