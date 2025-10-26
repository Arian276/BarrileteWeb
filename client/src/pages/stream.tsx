import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useViewerCount } from "@/hooks/useViewerCount";
import { VideoPlayer } from "@/components/video-player";
import { Chat } from "@/components/chat";
import {
  PlayCircle,
  Maximize2,
  Users,
  Tv,
  Wifi,
  WifiOff,
  Signal,
  Zap,
  Activity,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Stream } from "@shared/schema";
import tntSportsLogo from "@assets/tnt-sports-logo.jpg";
import espnPremiumLogo from "@assets/espn-premium-logo.png";

export default function StreamPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [prevViewerCount, setPrevViewerCount] = useState(0);
  const [showViewerAnimation, setShowViewerAnimation] = useState(false);
  const [headerHover, setHeaderHover] = useState(false);
  const { streamId } = useParams<{ streamId: string }>();

  
  const [showBanner, setShowBanner] = useState(true);
  useEffect(() => setShowBanner(true), [streamId]);
  
  const qc = useQueryClient();
  const sid = streamId || "espn-premium-hd";

  const [liked, setLiked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`likes:${sid}:liked`) === "1";
    } catch {
      return false;
    }
  });

  const {
    data: likeCount = 0,
    refetch: refetchLikes,
  } = useQuery<number>({
    queryKey: ["likes", sid],
    queryFn: async () => {
      try {
        const r = await fetch(`/api/likes?streamId=${encodeURIComponent(sid)}`);
        if (!r.ok) throw new Error("no server");
        const j = await r.json();
        return Number(j.count ?? 0);
      } catch {
        const raw = localStorage.getItem(`likes:${sid}:count`);
        return Number(raw ?? 0);
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: false, // 👈 sin polling automático
  });

  // Poll suave cada 20s solo si la pestaña está visible
  useEffect(() => {
    let t: number | undefined;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        await refetchLikes();
      }
      t = window.setTimeout(tick, 20_000);
    };
    t = window.setTimeout(tick, 20_000);
    return () => clearTimeout(t);
  }, [refetchLikes]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (liked) return true;
      
      const newCount = likeCount + 1;
      localStorage.setItem(`likes:${sid}:count`, String(newCount));
      localStorage.setItem(`likes:${sid}:liked`, "1");

      try {
        await fetch(`/api/likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ streamId: sid }),
        });
      } catch {
        
      }
      return true;
    },
    onSuccess: () => {
      setLiked(true);
      qc.invalidateQueries({ queryKey: ["likes", sid] });
    },
  });

  const toggleLike = () => {
    if (!liked) likeMutation.mutate();
  };
  

  const { viewerCount, isConnected } = useViewerCount(streamId || "espn-premium-hd");

  useEffect(() => {
    if (viewerCount !== prevViewerCount && prevViewerCount > 0) {
      setShowViewerAnimation(true);
      const timeout = setTimeout(() => setShowViewerAnimation(false), 600);
      return () => clearTimeout(timeout);
    }
    setPrevViewerCount(viewerCount);
  }, [viewerCount, prevViewerCount]);

  const { data: stream, isLoading } = useQuery<Stream>({
    queryKey: ["/api/streams", streamId],
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center football-pattern">
        <div className="text-center animate-fade-in-scale">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4 glow-celeste"></div>
          <p className="text-muted-foreground shimmer">Cargando transmisión...</p>
          <div className="text-xs text-primary mt-2 animate-pulse">Estableciendo conexión segura...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {!isFullscreen && (
        <header
          className={`bg-card/80 backdrop-blur-sm border-b border-border px-3 md:px-4 py-2 md:py-3 fixed top-0 w-full z-50 transition-all duration-300 ${
            headerHover ? "bg-card/90 glow-celeste" : ""
          }`}
          onMouseEnter={() => setHeaderHover(true)}
          onMouseLeave={() => setHeaderHover(false)}
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Link to="/" className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Tv
                  className={`text-primary w-5 h-5 md:w-6 md:h-6 transition-all duration-300 ${
                    headerHover ? "animate-ball-spin text-gradient-argentina" : ""
                  }`}
                />
                <h1
                  className={`text-base md:text-lg font-bold transition-all duration-300 ${
                    headerHover ? "text-gradient-argentina" : "text-primary"
                  }`}
                >
                  Barrilete Cósmico
                </h1>
              </div>
              {stream && (
                <Badge
                  variant="secondary"
                  className={`text-xs shimmer transition-all duration-300 ${
                    headerHover ? "glow-orange scale-105" : ""
                  }`}
                >
                  {streamId === "tnt-sports-hd" ? (
                    <img
                      src={tntSportsLogo}
                      alt="TNT Sports HD"
                      className={`w-3 h-3 mr-1 object-contain transition-transform duration-300 ${
                        headerHover ? "scale-110" : ""
                      }`}
                    />
                  ) : streamId === "espn-premium-hd" ? (
                    <img
                      src={espnPremiumLogo}
                      alt="ESPN Premium HD"
                      className={`w-3 h-3 mr-1 object-contain transition-transform duration-300 ${
                        headerHover ? "scale-110" : ""
                      }`}
                    />
                  ) : (
                    <PlayCircle
                      className={`w-3 h-3 mr-1 transition-transform duration-300 ${
                        headerHover ? "scale-110" : ""
                      }`}
                    />
                  )}
                  {stream.title}
                </Badge>
              )}
            </Link>

            <div className="flex items-center space-x-3">
              <div className="flex items-center text-xs md:text-sm">
                <div className="w-2 h-2 rounded-full mr-2 bg-primary pulse-live"></div>
                <Signal className="w-3 h-3 mr-1 pulse-connection" />
                <span className="argentina-gradient text-transparent bg-clip-text font-bold">
                  EN VIVO
                </span>
                <Zap className="w-3 h-3 ml-1 text-primary" />
              </div>
              <div
                className={`flex items-center text-xs md:text-sm text-muted-foreground transition-all duration-300 ${
                  showViewerAnimation ? "animate-bounce-number glow-celeste" : ""
                }`}
              >
                <Users
                  className={`w-3 h-3 mr-1 transition-all duration-300 ${
                    showViewerAnimation ? "text-primary scale-110" : ""
                  }`}
                />
                <span
                  className={`tabular-nums transition-all duration-300 ${
                    showViewerAnimation ? "text-primary font-bold scale-110" : ""
                  }`}
                >
                  {viewerCount}
                </span>{" "}
                espectadores
                {isConnected ? (
                  <Wifi className="w-3 h-3 ml-1 text-green-500 pulse-connection" />
                ) : (
                  <WifiOff className="w-3 h-3 ml-1 text-red-500 animate-pulse" />
                )}
              </div>

              <Button
                onClick={() => {
                  const mpApp = "mercadopago://mpago.la/123456"; 
                  const mpWeb = "https://mpago.la/123456"; 
                  window.location.href = mpApp;
                  setTimeout(() => {
                    window.location.href = mpWeb;
                  }, 1000);
                }}
                className="bg-[#009EE3] hover:bg-[#0077B5] text-white px-5 py-2 rounded-lg font-bold text-sm md:text-base transition-transform transform hover:scale-105"
              >
                💙 Donar con MercadoPago
              </Button>

              <button
                type="button"
                onClick={toggleFullscreen}
                data-testid="button-fullscreen"
                className="button-click-effect enhanced-hover"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`${!isFullscreen ? "pt-20 md:pt-28 lg:pt-32" : ""} px-2 md:px-4 lg:px-6 pb-6`}>
        <div className="max-w-7xl mx-auto">
          <div className={`${!isFullscreen ? "mb-4 md:mb-6" : "h-screen"}`}>
            <VideoPlayer
              streamId={streamId || "espn-premium-hd"}
              streamUrl={stream?.processedUrl ?? stream?.sourceUrl}
              isLoading={isLoading}
              quality={stream?.quality || "HD 1080p"}
              title={stream?.title || "ESPN Premium HD AR"}
            />
          </div>

          {!isFullscreen && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6">
              <div className="xl:col-span-3">
                <Card className="enhanced-hover">
                  <CardContent className="p-4 md:p-6">
                    <div className="space-y-4">
                      <div className="animate-fade-in-scale">
                        <h2 className="text-xl md:text-2xl font-bold mb-2 text-gradient-argentina">
                          {stream?.title || "ESPN Premium HD AR"}
                        </h2>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge variant="outline" className="shimmer glow-celeste">
                            <Activity className="w-3 h-3 mr-1" />
                            {stream?.quality || "HD 1080p"}
                          </Badge>
                          <Badge variant="outline" className="shimmer">
                            {stream?.audioQuality || "Alta Calidad"}
                          </Badge>
                          <Badge variant="secondary" className="argentina-gradient">
                            Deportes
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm animate-slide-in-up animate-delay-200">
                        <div className="enhanced-hover p-2 rounded-lg">
                          <p className="text-muted-foreground mb-1">Estado</p>
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 pulse-live"></div>
                            <span className="font-medium">En Vivo</span>
                            <Zap className="w-3 h-3 ml-1 text-primary" />
                          </div>
                        </div>
                        <div className="enhanced-hover p-2 rounded-lg">
                          <p className="text-muted-foreground mb-1">Calidad</p>
                          <p className="font-medium text-primary">{stream?.quality || "HD 1080p"}</p>
                        </div>
                        <div className="enhanced-hover p-2 rounded-lg">
                          <p className="text-muted-foreground mb-1">Audio</p>
                          <p className="font-medium text-primary">{stream?.audioQuality || "Alta"}</p>
                        </div>
                        <div
                          className={`enhanced-hover p-2 rounded-lg transition-all duration-300 ${
                            showViewerAnimation ? "glow-celeste scale-105" : ""
                          }`}
                        >
                          <p className="text-muted-foreground mb-1">Espectadores</p>
                          <div className="flex items-center">
                            <p
                              className={`font-medium tabular-nums transition-all duration-300 ${
                                showViewerAnimation ? "text-primary animate-bounce-number" : ""
                              }`}
                            >
                              {viewerCount}
                            </p>
                            <Users
                              className={`w-3 h-3 ml-1 transition-all duration-300 ${
                                showViewerAnimation ? "text-primary scale-110" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="animate-slide-in-up animate-delay-300 enhanced-hover p-3 rounded-lg">
                        <h3 className="font-semibold mb-2 text-gradient-argentina">Información del Canal</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          ESPN Premium HD Argentina - Transmisión deportiva en alta definición. Disfruta de los mejores
                          eventos deportivos con calidad profesional.
                        </p>
                        <div className="flex items-center mt-2 text-xs text-primary">
                          <Signal className="w-3 h-3 mr-1 pulse-connection" />
                          <span>Señal estable • Baja latencia • HD</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-2 animate-slide-in-up animate-delay-400">
                <div className="enhanced-hover">
                  <Chat streamId={streamId} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== Modal flotante ===== */}
      {showBanner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-[92%] max-w-md rounded-2xl bg-white shadow-2xl p-5 text-center border border-black/5">
            <button
              onClick={() => setShowBanner(false)}
              className="absolute top-2.5 right-3 text-xl leading-none hover:scale-110 transition"
              aria-label="Cerrar anuncio"
              title="Cerrar"
            >
              ❌
            </button>

            <div className="flex items-center justify-center gap-2 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-red-500 fill-current">
                <path d="M12 21s-6.716-4.534-9.428-7.246C.862 12.044.5 10.77.5 9.5A4.5 4.5 0 0 1 10 7.5c.63.63 1.15 1.274 2 2.5.85-1.226 1.37-1.87 2-2.5A4.5 4.5 0 0 1 23.5 9.5c0 1.27-.362 2.544-2.072 4.254C18.716 16.466 12 21 12 21z" />
              </svg>
              <h3 className="text-lg font-bold text-gray-900">Apoyá el proyecto</h3>
            </div>

            <p className="text-sm text-gray-700">
              Alias: <span className="font-mono font-semibold">barriletecosmicoTv</span>
            </p>

            <div className="mt-4 flex justify-center items-center gap-4">
              <img src={tntSportsLogo as string} alt="TNT Sports" className="h-10 w-auto object-contain drop-shadow-sm" />
              <img src={espnPremiumLogo as string} alt="ESPN Premium" className="h-10 w-auto object-contain drop-shadow-sm" />
            </div>
          </div>
        </div>
      )}
      {/* ===== /Modal ===== */}
    </div>
  );
}