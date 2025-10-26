import { useEffect, useMemo, useRef, useState } from "react";

type WsMsg =
  | { type: "joined_stream"; streamId: string; viewerCount: number }
  | { type: "viewer_count_update"; streamId: string; viewerCount: number }
  | { type: "heartbeat_response" }
  | { type: "error"; message: string }
  | Record<string, unknown>;

function wsUrl(): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/ws`;
}

export function useViewerCount(streamId: string) {
  const [viewerCount, setViewerCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  
  const userId = useMemo(
    () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    []
  );

  const wsRef = useRef<WebSocket | null>(null);
  const hbRef = useRef<number | null>(null);
  const retryRef = useRef(0);
  const manualCloseRef = useRef(false);
  const joinedRef = useRef<string | null>(null); 

  useEffect(() => {
    if (!streamId) return;

    manualCloseRef.current = false;
    setIsLoading(true);

    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        
        if (joinedRef.current && joinedRef.current !== streamId) {
          wsRef.current.send(JSON.stringify({ type: "leave_stream" }));
          joinedRef.current = null;
        }
        
        wsRef.current.send(JSON.stringify({ type: "join_stream", streamId, userId }));
        joinedRef.current = streamId;
        setIsLoading(false);
      } catch {
      
        try { wsRef.current.close(); } catch {}
      }
    }

    const connect = () => {
     
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsLoading(false);
        retryRef.current = 0;

    
        try {
          ws.send(JSON.stringify({ type: "join_stream", streamId, userId }));
          joinedRef.current = streamId;
        } catch {}

        
        hbRef.current = window.setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          } catch {}
        }, 20000);
      };

      ws.onmessage = (ev) => {
        let msg: WsMsg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

      
        if (
          (msg.type === "joined_stream" || msg.type === "viewer_count_update") &&
          msg.streamId === streamId &&
          typeof msg.viewerCount === "number"
        ) {
          setViewerCount(msg.viewerCount);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (hbRef.current) {
          clearInterval(hbRef.current);
          hbRef.current = null;
        }
        wsRef.current = null;
        joinedRef.current = null;

        
        if (!manualCloseRef.current) {
          const delay = Math.min(3000 * (retryRef.current + 1), 10000);
          retryRef.current++;
          window.setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    };

    connect();

    return () => {
      
      manualCloseRef.current = true;
      setIsConnected(false);

      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          
          if (joinedRef.current) {
            wsRef.current.send(JSON.stringify({ type: "leave_stream" }));
          }
        }
      } catch {}

      try {
        wsRef.current?.close();
      } catch {}

      joinedRef.current = null;
      wsRef.current = null;

      if (hbRef.current) {
        clearInterval(hbRef.current);
        hbRef.current = null;
      }

      setIsLoading(true);
      setViewerCount(0);
    };
  }, [streamId, userId]);

  return { viewerCount, isConnected, isLoading };
}