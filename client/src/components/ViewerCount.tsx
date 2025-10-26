
import { useQuery } from "@tanstack/react-query";
import { Users, Wifi, WifiOff } from "lucide-react";
import { useViewerCount as useViewerWs } from "@/hooks/useViewerCount";

type Mode = "list" | "view";

interface ViewerCountProps {
  streamId: string;
  className?: string;
  showConnection?: boolean;
  mode?: Mode;
}

function useViewerPolling(streamId: string) {
  const { data } = useQuery({
    queryKey: ["/api/viewers", streamId],
    queryFn: async () => {
      const res = await fetch(`/api/viewers/${encodeURIComponent(streamId)}`);
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      return (json?.viewerCount ?? 0) as number;
    },
    refetchInterval: 10_000, // cada 10s
    staleTime: 5_000,
  });

  return data ?? 0;
}

export function ViewerCount({
  streamId,
  className = "",
  showConnection = false,
  mode = "list",
}: ViewerCountProps) {
  const viewerCount =
    mode === "list"
      ? useViewerPolling(streamId)
      : useViewerWs(streamId).viewerCount;

  const isConnected =
    mode === "list" ? true : useViewerWs(streamId).isConnected;

  return (
    <div className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}>
      <Users className="h-4 w-4" />
      <span className="tabular-nums" data-testid={`text-viewers-${streamId}`}>
        {viewerCount}
      </span>
      {showConnection && (
        isConnected ? (
          <Wifi className="h-3 w-3 text-green-500" />
        ) : (
          <WifiOff className="h-3 w-3 text-red-500" />
        )
      )}
    </div>
  );
}