import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { ViewerCount } from "@/components/ViewerCount";
import { AnimatedSoccerButton } from "@/components/AnimatedSoccerButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Signal, Tv, Sparkles } from "lucide-react";
import { type Stream } from "@shared/schema";


import tntSportsLogo from "@assets/tnt-sports-logo.jpg";
import espnPremiumLogo from "@assets/espn-premium-logo.png";
import directvSportLogo from "@assets/directv.png";
import directvPlusLogo from "@assets/directvPlus.png";
import espnHdLogo from "@assets/Espn1.png";
import espn2HdLogo from "@assets/Espn2.png";
import espn3HdLogo from "@assets/Espn3.png";
import foxSportsLogo from "@assets/fox-sports.png";


const LOGOS: Record<string, { src: string; alt: string }> = {
  "tnt-sports-hd": { src: tntSportsLogo, alt: "TNT Sports HD" },
  "espn-premium-hd": { src: espnPremiumLogo, alt: "ESPN Premium HD" },
  "directv-sport": { src: directvSportLogo, alt: "DirecTV Sport" },
  "directv-plus": { src: directvPlusLogo, alt: "DirecTV+" },
  "espn-hd": { src: espnHdLogo, alt: "ESPN HD" },
  "espn2-hd": { src: espn2HdLogo, alt: "ESPN 2 HD" },
  "espn3-hd": { src: espn3HdLogo, alt: "ESPN 3 HD" },
  "fox-sports-hd": { src: foxSportsLogo, alt: "Fox Sports HD" },
};

function HomePage() {
  const { data: streams, isLoading } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  
  const [hoverState, setHoverState] = useState<Record<string, boolean>>({});
  const handleCardHover = (id: string, on: boolean) =>
    setHoverState((p) => ({ ...p, [id]: on }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Cargando canales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="bg-primary rounded-lg p-2 animate-ball-spin">
                <Tv className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold text-gradient-argentina animate-fade-in-scale"
                  data-testid="text-app-title"
                >
                  Barrilete Cósmico
                </h1>
                <p className="text-sm text-muted-foreground animate-slide-in-up animate-delay-200">
                  Fútbol argentino • Pasión • En vivo
                </p>
              </div>
            </Link>
            <Badge
              variant="secondary"
              className="flex items-center space-x-1 bg-primary/10 text-primary border-primary/20 pulse-live glow-celeste"
            >
              <Signal className="h-3 w-3 pulse-connection" />
              <Sparkles className="h-3 w-3" />
              <span>EN VIVO</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid de canales */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {streams?.map((stream, index) => {
            const hover = !!hoverState[stream.id];
            const animationDelay = `animate-delay-${Math.min(
              (index + 1) * 100,
              500
            )}`;
            const logo = LOGOS[stream.id];

            return (
              <Card
                key={stream.id}
                className={`group card-hover-lift enhanced-hover transition-all duration-300 animate-slide-in-up ${animationDelay} ${
                  hover ? "glow-celeste" : ""
                }`}
                data-testid={`card-channel-${stream.id}`}
                data-stream-card
                data-stream-id={stream.id}
                onMouseEnter={() => handleCardHover(stream.id, true)}
                onMouseLeave={() => handleCardHover(stream.id, false)}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle
                        className={`text-lg transition-all duration-300 ${
                          hover ? "text-gradient-argentina" : ""
                        }`}
                      >
                        {stream.title}
                      </CardTitle>
                      <CardDescription className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {(stream.metadata as any)?.channel || "Canal"}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shimmer">
                          {stream.quality}
                        </Badge>
                      </CardDescription>
                    </div>

                    {/*  contador por canal con polling */}
                    <ViewerCount streamId={stream.id} mode="list" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="bg-black rounded-lg aspect-video flex items-center justify-center p-4 relative overflow-hidden">
                    {logo ? (
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className={`max-h-full max-w-full object-contain relative z-10 transition-transform duration-300 ${
                          hover ? "scale-110" : ""
                        }`}
                        data-testid={`img-logo-${stream.id}`}
                      />
                    ) : (
                      <PlayCircle className="h-12 w-12 text-muted-foreground/50" />
                    )}
                  </div>

                  <AnimatedSoccerButton streamId={stream.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HomePage;