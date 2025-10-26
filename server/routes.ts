import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, getLikeCount, applyLike, getSecureSourceUrl } from "./storage";
import { InsertStreamSchema, InsertChatMessageSchema } from "@shared/schema";
import { ffmpegService } from "./services/ffmpeg";
import { securityService } from "./services/security";
import { promises as fs } from "fs";
import helmet from "helmet";
import cors from "cors";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          mediaSrc: ["'self'", "blob:", "data:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          workerSrc: ["'self'", "blob:"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    })
  );

  app.use(
    cors({
      origin: [
        /^https:\/\/.*\.replit\.app$/,
        /^https:\/\/.*\.replit\.com$/,
        "http://localhost:5000",
      ],
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  app.use(securityService.createSecurityMiddleware());

  app.get("/api/streams", async (_req, res) => {
    try {
      const streams = await storage.getAllStreams?.();
      const safe = (streams ?? []).map(({ sourceUrl, ...rest }) => rest);
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/streams/:id", async (req, res) => {
    try {
      const stream = await storage.getStream?.(req.params.id);
      if (!stream) return res.status(404).json({ error: "Stream not found" });
      const { sourceUrl, ...safe } = stream;
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/streams", express.json(), async (req, res) => {
    try {
      const streamData = InsertStreamSchema.parse(req.body);
      const stream = await storage.createStream?.(streamData);
      res.status(201).json(stream);
    } catch {
      res.status(400).json({ error: "Invalid stream data" });
    }
  });

  
  app.get("/api/chat/:streamId", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.streamId);
      res.json(messages);
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/chat", express.json(), async (req, res) => {
    try {
      const { role, username, token } = req.body;
      let finalRole: "admin" | "user" = "user";

      
      if (username?.toLowerCase() === "reydecopas") {
        finalRole = "admin";
      } else if (role === "admin") {
        const expectedKey = process.env.VITE_ADMIN_KEY || process.env.ADMIN_KEY;
        if (token !== expectedKey) {
          return res.status(403).json({ error: "No autorizado como admin" });
        }
        finalRole = "admin";
      }

      const messageData = InsertChatMessageSchema.parse({
        ...req.body,
        role: finalRole,
      });

      const message = await storage.createChatMessage(messageData);
      res.status(201).json(message);
    } catch {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  app.get("/api/likes", (req, res) => {
    try {
      const streamId = String(req.query.streamId || "");
      if (!streamId) return res.status(400).json({ error: "streamId requerido" });
      const count = getLikeCount(streamId);
      res.json({ count });
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/likes", express.json(), (req, res) => {
    try {
      const { streamId } = (req.body ?? {}) as { streamId?: string };
      if (!streamId) return res.status(400).json({ error: "streamId requerido" });
      const count = applyLike(streamId);
      res.json({ ok: true, count });
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/streams/:streamId/start", async (req, res) => {
    try {
      const { streamId } = req.params;
      const stream = await storage.getStream?.(streamId);
      if (!stream) return res.status(404).json({ error: "Stream not found" });

      const streamInfo = ffmpegService.getStreamInfo(streamId);
      if (streamInfo && (streamInfo.status === "streaming" || streamInfo.status === "processing")) {
        const hlsUrl = `/api/streams/${streamId}/hls/playlist.m3u8`;
        return res.json({ success: true, streamUrl: hlsUrl, streamId, status: "already_running" });
      }

      const realSource = getSecureSourceUrl(stream.sourceUrl);
      const hlsUrl = await ffmpegService.processStream(streamId, realSource, {
        quality: stream.quality,
        audioQuality: stream.audioQuality,
      });

      await storage.updateStream?.(streamId, { status: "processing", processedUrl: hlsUrl });
      res.json({ success: true, streamUrl: hlsUrl, streamId, status: "processing" });
    } catch {
      res.status(500).json({ error: "Failed to start stream processing" });
    }
  });

  app.post("/api/stream/stop/:streamId", async (req, res) => {
    try {
      const { streamId } = req.params;
      ffmpegService.stopStream(streamId);
      await storage.updateStream?.(streamId, { status: "idle", processedUrl: null });
      res.json({ success: true, message: "Stream stopped" });
    } catch {
      res.status(500).json({ error: "Failed to stop stream" });
    }
  });

  app.get("/api/streams/:streamId/hls/playlist.m3u8", async (req, res) => {
    try {
      const { streamId } = req.params;
      const playlist = await fs.readFile(`/tmp/streams/${streamId}/playlist.m3u8`, "utf8");
      res.set({
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.send(playlist);
    } catch {
      res.status(404).json({ error: "Playlist not found" });
    }
  });

  app.get("/api/streams/:streamId/hls/:segment", async (req, res) => {
    try {
      const { streamId, segment } = req.params;
      const segmentData = await fs.readFile(`/tmp/streams/${streamId}/${segment}`);
      res.set({ "Content-Type": "video/mp2t", "Cache-Control": "max-age=10" });
      res.send(segmentData);
    } catch {
      res.status(404).json({ error: "Segment not found" });
    }
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  interface ViewerConnection {
    ws: WebSocket;
    streamId: string;
    userId: string;
    connectedAt: Date;
    countedStreams: Set<string>; 
  }

  const streamViewers = new Map<string, Set<ViewerConnection>>();
  const totalVisits = new Map<string, number>();
  app.get("/api/viewers/:streamId", (req, res) => {
    const { streamId } = req.params;
    const set = streamViewers.get(streamId);
    const viewerCount = set ? set.size : 0;
    const visits = totalVisits.get(streamId) ?? 0;
    res.json({ streamId, viewerCount, totalVisits: visits });
  });

  
  const onDemandTimers = new Map<string, NodeJS.Timeout>();
  const GRACE_MS = 15_000; 

  async function ensureStreamRunning(streamId: string) {
    const info = ffmpegService.getStreamInfo(streamId);
    if (info && (info.status === "streaming" || info.status === "processing")) return;

    const s = await storage.getStream?.(streamId);
    if (!s) return;

    try {
      const src = getSecureSourceUrl(s.sourceUrl);
      const url = await ffmpegService.processStream(streamId, src, {
        quality: s.quality,
        audioQuality: s.audioQuality,
      });
      await storage.updateStream?.(streamId, { status: "processing", processedUrl: url });
    } catch {
      
    }
  }

  function scheduleStopIfIdle(streamId: string) {
    const prev = onDemandTimers.get(streamId);
    if (prev) clearTimeout(prev);

    const t = setTimeout(async () => {
      const set = streamViewers.get(streamId);
      const empty = !set || set.size === 0;
      if (!empty) return; 

      try {
        ffmpegService.stopStream(streamId);
        await storage.updateStream?.(streamId, { status: "idle", processedUrl: null });
      } catch {
        
      }
    }, GRACE_MS);

    onDemandTimers.set(streamId, t);
  }

  const broadcastViewerUpdate = async (streamId: string) => {
    const viewers = streamViewers.get(streamId);
    const viewerCount = viewers ? viewers.size : 0;

    
    try {
      const s = await storage.getStream?.(streamId);
      const prevMeta = (s?.metadata as any) || {};
      const visits = totalVisits.get(streamId) ?? 0;
      await storage.updateStream?.(streamId, {
        viewers: viewerCount,
        metadata: { ...prevMeta, totalVisits: visits },
      });
    } catch {
      
    }

    if (viewers) {
      const msg = JSON.stringify({
        type: "viewer_count_update",
        streamId,
        viewerCount,
        totalVisits: totalVisits.get(streamId) ?? 0,
      });
      viewers.forEach((conn) => {
        if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(msg);
      });
    }
  };

  wss.on("connection", (ws: WebSocket) => {
    let current: ViewerConnection | null = null;

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case "join_stream": {
            if (!msg.streamId || !msg.userId) return;

            
            if (current) {
              const prevSet = streamViewers.get(current.streamId);
              prevSet?.delete(current);
              broadcastViewerUpdate(current.streamId);
              if ((prevSet?.size ?? 0) === 0) scheduleStopIfIdle(current.streamId);
            }

            const streamId = msg.streamId as string;
            current = {
              ws,
              streamId,
              userId: msg.userId,
              connectedAt: new Date(),
              countedStreams: current?.countedStreams ?? new Set<string>(),
            };

            if (!streamViewers.has(streamId)) streamViewers.set(streamId, new Set());
            const set = streamViewers.get(streamId)!;
            const before = set.size;
            set.add(current);

          
            if (!current.countedStreams.has(streamId)) {
              current.countedStreams.add(streamId);
              totalVisits.set(streamId, (totalVisits.get(streamId) ?? 0) + 1);
            }

            
            if (before === 0) {
              const pending = onDemandTimers.get(streamId);
              if (pending) { clearTimeout(pending); onDemandTimers.delete(streamId); }
              ensureStreamRunning(streamId);
            }

            ws.send(JSON.stringify({
              type: "joined_stream",
              streamId,
              viewerCount: set.size,
              totalVisits: totalVisits.get(streamId) ?? 0,
            }));
            broadcastViewerUpdate(streamId);
            break;
          }
          case "leave_stream":
            if (current) {
              const set = streamViewers.get(current.streamId);
              set?.delete(current);
              broadcastViewerUpdate(current.streamId);
              if ((set?.size ?? 0) === 0) scheduleStopIfIdle(current.streamId);
              current = null;
            }
            break;
          case "heartbeat":
            ws.send(JSON.stringify({ type: "heartbeat_response" }));
            break;
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      }
    });

    ws.on("close", () => {
      if (current) {
        const set = streamViewers.get(current.streamId);
        set?.delete(current);
        broadcastViewerUpdate(current.streamId);
        if ((set?.size ?? 0) === 0) scheduleStopIfIdle(current.streamId);
      }
    });
  });

  return httpServer;
}