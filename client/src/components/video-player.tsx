import { useEffect, useRef, useState } from "react";
import { Signal, Lightbulb, Music, Smartphone } from "lucide-react";
import Hls from "hls.js";
import ReactPlayer from "react-player";
import { apiRequest } from "@/lib/queryClient";
import { useCasting } from "@/hooks/useCasting";
import { CastingControls } from "@/components/CastingControls";

interface VideoPlayerProps {
  streamId: string; 
  streamUrl?: string;
  isLoading?: boolean;
  quality?: string;
  title?: string;
}

function isYouTubeUrl(url?: string) {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export function VideoPlayer({
  streamId,
  streamUrl,
  isLoading = false,
  quality = "HD 1080p",
  title = "Canal de Deportes",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [hasError, setHasError] = useState(false);
  const [streamStatus, setStreamStatus] = useState<
    "initializing" | "starting" | "ready" | "error"
  >("initializing");
  const [hlsReady, setHlsReady] = useState(false);
  const [isBackgroundPlayEnabled, setIsBackgroundPlayEnabled] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isYouTube = isYouTubeUrl(streamUrl);

  const hlsStreamUrl = isYouTube ? streamUrl : `/api/streams/${streamId}/hls/playlist.m3u8`;
  const [castingCapabilities, castingActions] = useCasting(videoRef, hlsStreamUrl);

  useEffect(() => {
    const detectMobile = () => {
      const ua = navigator.userAgent.toLowerCase();
      const isM =
        /mobile|android|iphone|ipad|phone/i.test(ua) ||
        "ontouchstart" in window ||
        window.innerWidth <= 768;
      setIsMobile(isM);
    };
    detectMobile();
    window.addEventListener("resize", detectMobile);
    return () => window.removeEventListener("resize", detectMobile);
  }, []);

  useEffect(() => {
    if (isYouTube || !isMobile || !hlsReady || !isBackgroundPlayEnabled) return;

    const setupMobileAudio = () => {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "auto";
      const hlsUrl = `/api/streams/${streamId}/hls/playlist.m3u8`;

      if (Hls.isSupported()) {
        const audioHls = new Hls(createHLSConfig());
        audioHls.loadSource(hlsUrl);
        audioHls.attachMedia(audio);
        audioHls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) audioHls.destroy();
        });
        audioRef.current = audio;
        return () => audioHls.destroy();
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = hlsUrl;
        audioRef.current = audio;
      }
    };

    return setupMobileAudio();
  }, [isYouTube, isMobile, hlsReady, isBackgroundPlayEnabled, streamId]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !hlsReady) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || "Transmisión",
      artist: "Barrilete Cósmico",
      artwork: [{ src: "/favicon.ico", sizes: "96x96", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      const v = videoRef.current;
      if (v && v.paused) v.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      const v = videoRef.current;
      if (v && !v.paused) v.pause();
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [hlsReady, title]);

  useEffect(() => {
    if (isYouTube) return;
    const onVis = () => {
      const v = videoRef.current;
      if (!v || !isBackgroundPlayEnabled || !userInteracted) return;
      if (document.hidden) {
        if (v.paused && !hasError && hlsReady) {
          v.play().catch(() => {});
        }
      } else {
        if (v.paused && !hasError && hlsReady) {
          v.play().catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isYouTube, isBackgroundPlayEnabled, hasError, hlsReady, userInteracted]);

  const createHLSConfig = () => ({
    enableWorker: true,
    lowLatencyMode: true,
    backBufferLength: 30,
    maxBufferLength: 60,
    maxBufferSize: 30 * 1000 * 1000,
    liveSyncDurationCount: 2,
    liveMaxLatencyDurationCount: 3,
    liveDurationInfinity: true,
    maxMaxBufferLength: 120,
    progressive: false,
    debug: false,
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 3,
    manifestLoadingRetryDelay: 500,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 3,
    levelLoadingRetryDelay: 500,
    fragLoadingTimeOut: 20000,
    fragLoadingMaxRetry: 3,
    fragLoadingRetryDelay: 500,
    xhrSetup: (xhr: XMLHttpRequest, url: string) => {
      const token = localStorage.getItem("streamToken");
      if (token && (url.includes("/key") || url.includes("/hls/"))) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
      xhr.setRequestHeader("Cache-Control", "no-cache");
      if (typeof window !== "undefined") {
        xhr.setRequestHeader("Referer", window.location.href);
      }
    },
  });

  useEffect(() => {
   
    if (isYouTube) {
      setStreamStatus("ready");
      setHlsReady(true);
      return;
    }

    const init = async () => {
      try {
        setStreamStatus("starting");
        const r = await apiRequest("POST", `/api/streams/${streamId}/start`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data.success && data.streamUrl) {
          const delay = data.status === "processing" ? 8000 : 2000;
          setTimeout(() => setupHLSPlayer(data.streamUrl), delay);
        } else {
          throw new Error(data.error || "Failed to start stream");
        }
      } catch (e) {
        setStreamStatus("error");
        setHasError(true);
      }
    };

    init();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isYouTube, streamId]);

  const setupHLSPlayer = (hlsUrl: string) => {
    const v = videoRef.current;
    if (!v) return;

    setHasError(false);
    v.playsInline = true;
    v.preload = "auto";

    const onInteract = () => setUserInteracted(true);
    v.addEventListener("click", onInteract);
    v.addEventListener("play", onInteract);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls(createHLSConfig());
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setStreamStatus("ready");
        setHlsReady(true);
        v.muted = false;
        v.play().catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (d.fatal) {
          setHasError(true);
          setStreamStatus("error");
          switch (d.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (streamStatus !== "ready") {
          setStreamStatus("ready");
          setHlsReady(true);
        }
      });
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = hlsUrl;
      v.addEventListener("loadedmetadata", () => {
        setStreamStatus("ready");
        setHlsReady(true);
      });
    } else {
      setHasError(true);
      setStreamStatus("error");
    }
  };

  const showLoading =
    isLoading ||
    streamStatus === "starting" ||
    (streamStatus === "ready" && !hlsReady);

  return (
    <div className="relative mb-4 md:mb-6">
      <div className="video-player bg-black rounded-md md:rounded-lg overflow-hidden shadow-lg md:shadow-2xl aspect-video">
        {}
        {isYouTube ? (
          <ReactPlayer
            url={streamUrl}
            controls
            playing
            width="100%"
            height="100%"
            config={{
              youtube: {
                playerVars: {
                  modestbranding: 1,
                  rel: 0,
                  iv_load_policy: 3,
                } as any,
              },
            }}
          />
        ) : (
          
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            controls
            controlsList="nodownload"
            playsInline
            preload="auto"
            crossOrigin="anonymous"
            data-testid="video-player"
            {...({
              "x-webkit-airplay": "allow" as any,
              "webkit-playsinline": "true" as any,
              "disablePictureInPicture": false
            })}
          >
            Tu navegador no soporta la reproducción de video.
          </video>
        )}

        {}
        <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-black/70 px-2 py-1 md:px-3 md:py-1 rounded text-white text-xs md:text-sm">
          <Signal className="inline w-3 h-3 md:w-4 md:h-4 mr-1" />
          <span data-testid="text-quality">{quality}</span>
        </div>

        {}
        {!isYouTube && (
          <div className="absolute top-2 right-2 md:top-4 md:right-4">
            <CastingControls 
              capabilities={castingCapabilities}
              actions={castingActions}
              className="bg-black/70 rounded p-1"
            />
          </div>
        )}

        {}
        {!isYouTube && hlsReady && isBackgroundPlayEnabled && !userInteracted && (
          <div className="absolute bottom-4 left-4 right-4 bg-blue-600/90 text-white p-3 rounded text-sm">
            <div className="flex items-center space-x-2 mb-2">
              {isMobile ? <Smartphone className="w-4 h-4" /> : <Music className="w-4 h-4" />}
              <p>Para reproducción en segundo plano:</p>
            </div>
            <ol className="text-xs space-y-1">
              <li>1. Toca el video para activar audio</li>
              <li>2. Cambiá de app/pestaña: seguirá reproduciendo</li>
            </ol>
          </div>
        )}

        {}
        {!isYouTube && showLoading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="relative text-center">
              <div className="relative text-3xl md:text-5xl font-bold">
                <div
                  className="absolute inset-0 text-transparent"
                  style={{ WebkitTextStroke: "2px white" } as React.CSSProperties}
                >
                  Barrilete Cósmico
                </div>
                <div className="relative overflow-hidden">
                  <div
                    className="text-white brand-fill-animation"
                    style={{ animation: "brand-fill 2s ease-in-out infinite" }}
                  >
                    Barrilete Cósmico
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}