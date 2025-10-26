
const __WRITE = process.stdout.write.bind(process.stdout);
const __EWRITE = process.stderr.write.bind(process.stderr);

{
  const noop = () => {};
  // @ts-ignore
  console.log = noop;
  // @ts-ignore
  console.info = noop;
  // @ts-ignore
  console.warn = noop;
  // @ts-ignore
  console.error = noop;
  // @ts-ignore
  console.debug = noop;
}

import express, { type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { storage } from "./storage";
import { ffmpegService } from "./services/ffmpeg";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  const server = await registerRoutes(app);

  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    if (!res.headersSent) res.status(status).json({ message });
  });

  
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true });

  
  ffmpegService.on("streamInfoUpdated", async (streamId: string, info: { status: string }) => {
    try {
      const mappedStatus =
        info.status === "streaming"
          ? "streaming"
          : info.status === "processing"
          ? "processing"
          : info.status === "idle"
          ? "live"
          : "offline";

      const processedUrl =
        info.status === "streaming"
          ? `/api/streams/${streamId}/hls/playlist.m3u8`
          : null;

      await storage.updateStream?.(streamId, {
        status: mappedStatus as any,
        processedUrl,
      });
    } catch {
      
    }
  });

  
  const clearAndHome = () => __WRITE("\x1b[2J\x1b[H"); 
  let lastHash = "";

  const snapshot = async () => {
    try {
      const all = (await storage.getAllStreams?.()) ?? [];

      
      const byTitle = new Map<string, (typeof all)[number]>();
      for (const s of all) if (!byTitle.has(s.title)) byTitle.set(s.title, s);
      const unique = Array.from(byTitle.values()).sort((a, b) =>
        a.title.localeCompare(b.title, "es")
      );

      const payload = unique.map((s) => {
        const ff = ffmpegService.getStreamInfo(s.id)?.status ?? "idle";
        const chanOn = s.status === "streaming" || s.status === "processing";
        const ffOn = ff === "streaming";
        return {
          id: s.id,
          title: s.title,
          chan: chanOn ? "ON" : "OFF",
          ffmpeg: ffOn ? "ON" : "OFF",
          viewers: (s as any).viewers ?? 0,
          visits: (s?.metadata as any)?.totalVisits ?? 0,
        };
      });

      const jsonObj = { ts: new Date().toISOString(), streams: payload };
      const pretty = JSON.stringify(jsonObj, null, 2);

      
      const hash =
        String(pretty.length) +
        ":" +
        payload.map((p) => p.title + p.chan + p.ffmpeg + p.viewers + p.visits).join("|");
      if (hash === lastHash) return;

      lastHash = hash;
      clearAndHome();
      __WRITE(pretty + "\n");
    } catch {
      
    }
  };

  await snapshot();
  setInterval(snapshot, 10_000);
})();