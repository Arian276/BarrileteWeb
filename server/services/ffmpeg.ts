import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { promises as fs } from "fs";
import { getSecureSourceUrl } from "../storage";

export interface StreamInfo {
  bitrate: string;
  fps: string;
  quality: string;
  status: "idle" | "processing" | "streaming" | "error";
}

export class FFmpegService extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private streamInfo: Map<string, StreamInfo> = new Map();

  async processStream(
    streamId: string,
    sourceUrl: string,
    options: { quality: string; audioQuality: string }
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const existingInfo = this.getStreamInfo(streamId);
      if (existingInfo && existingInfo.status === "streaming") {
        const outputUrl = `/api/streams/${streamId}/hls/playlist.m3u8`;
        console.log(`✅ [FFmpeg] Stream ${streamId} ya en ejecución`);
        return resolve(outputUrl);
      }

      this.stopStream(streamId);

      const outputDir = `/tmp/streams/${streamId}`;
      try {
        await fs.rm(outputDir, { recursive: true, force: true });
      } catch {}
      await fs.mkdir(outputDir, { recursive: true, mode: 0o777 });

      const playlistPath = `${outputDir}/playlist.m3u8`;
      const segmentPattern = `${outputDir}/segment_%03d.ts`;
      const outputUrl = `/api/streams/${streamId}/hls/playlist.m3u8`;

      const args = [
        "-re",
        "-i", getSecureSourceUrl(sourceUrl),
        "-map", "0",

        "-vf" ,"yadif=0:-1:1,fps=25,scale=1280:720:flags=lanczos+accurate_rnd",
        "-c:v", "libx264",
        "-preset", "superfast",     
        "-tune", "zerolatency",
        "-crf", "30",                
        "-profile:v", "main",
        "-level", "3.1",
        "-pix_fmt", "yuv420p",

        "-g", "50",
        "-keyint_min", "50",
        "-sc_threshold", "0",

        
        "-c:a", "aac",
        "-b:a", "64k",
        "-ac", "1",
        "-ar", "22050",

       
        "-f", "hls",
        "-hls_time", "1",
        "-hls_list_size", "2",
        "-hls_flags", "delete_segments+append_list+independent_segments",
        "-hls_segment_filename", segmentPattern,
        "-hls_base_url", `/api/streams/${streamId}/hls/`,
        playlistPath,
      ];

      console.log(`🎬 [FFmpeg] Iniciando stream ${streamId}...`);

      const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
      this.processes.set(streamId, ffmpeg);

      this.streamInfo.set(streamId, {
        bitrate: "0 kbps",
        fps: "0",
        quality: options.quality,
        status: "processing",
      });

      let hasStarted = false;

      ffmpeg.stderr.on("data", (data) => {
        const output = data.toString();

     
        if (output.includes("frame=") || output.includes("bitrate=") || output.includes("fps=")) {
          console.log(`[FFmpeg:${streamId}] ${output.trim()}`);
        }

        if (
          (output.includes("frame=") || output.includes("Opening") || output.includes("muxer")) &&
          !hasStarted
        ) {
          hasStarted = true;
          this.updateStreamInfo(streamId, { status: "streaming" });
          this.emit("streamStarted", streamId);
          console.log(`✅ [FFmpeg] Stream ${streamId} iniciado correctamente`);

          const checkPlaylist = async () => {
            try {
              const playlist = await fs.readFile(playlistPath, "utf8");
              if (playlist.includes(".ts") && playlist.includes("#EXTINF")) {
                console.log(`✅ [FFmpeg] Playlist generada para ${streamId}`);
                resolve(outputUrl);
              } else {
                setTimeout(checkPlaylist, 1000);
              }
            } catch {
              setTimeout(checkPlaylist, 1000);
            }
          };
          setTimeout(checkPlaylist, 2000);
        }

        if (output.toLowerCase().includes("error") || output.toLowerCase().includes("failed")) {
          console.error(`❌ [FFmpeg] Error en ${streamId}:`, output);
        }
      });

      ffmpeg.on("error", (error) => {
        console.error(`❌ [FFmpeg] Proceso falló:`, error);
        this.updateStreamInfo(streamId, { status: "error" });
        this.emit("streamError", streamId, error);
        if (!hasStarted) reject(error);
      });

      ffmpeg.on("exit", (code, signal) => {
        console.log(`🛑 [FFmpeg] Proceso ${streamId} terminado (code=${code}, signal=${signal})`);
        this.processes.delete(streamId);
        this.updateStreamInfo(streamId, { status: "idle" });
        this.emit("streamEnded", streamId);
      });

      setTimeout(() => {
        if (!hasStarted) {
          console.error(`⏰ [FFmpeg] Stream ${streamId} no arrancó a tiempo`);
          this.stopStream(streamId);
          reject(new Error("Stream failed to start within timeout"));
        }
      }, 20000);
    });
  }

  stopStream(streamId: string): void {
    const process = this.processes.get(streamId);
    if (process) {
      console.log(`🛑 [FFmpeg] Deteniendo stream ${streamId}`);
      process.kill("SIGTERM");
      this.processes.delete(streamId);
      this.updateStreamInfo(streamId, { status: "idle" });
      this.emit("streamStopped", streamId);
    }
  }

  getStreamInfo(streamId: string): StreamInfo | undefined {
    return this.streamInfo.get(streamId);
  }

  private updateStreamInfo(streamId: string, updates: Partial<StreamInfo>): void {
    const current = this.streamInfo.get(streamId);
    if (current) {
      this.streamInfo.set(streamId, { ...current, ...updates });
      this.emit("streamInfoUpdated", streamId, this.streamInfo.get(streamId));
    }
  }

  cleanup(): void {
    console.log("🧹 [FFmpeg] Limpiando procesos...");
    this.processes.forEach((_, streamId) => this.stopStream(streamId));
  }
}

export const ffmpegService = new FFmpegService();