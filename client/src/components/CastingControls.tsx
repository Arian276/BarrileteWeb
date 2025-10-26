import { useState } from "react";
import { 
  Cast, 
  Maximize2, 
  Minimize2, 
  PictureInPicture2, 
  Smartphone, 
  Tv,
  MonitorSpeaker
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type CastingCapabilities, type CastingActions } from "@/hooks/useCasting";

interface CastingControlsProps {
  capabilities: CastingCapabilities;
  actions: CastingActions;
  className?: string;
}

export function CastingControls({ capabilities, actions, className = "" }: CastingControlsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCast = async (type: string, action: () => Promise<boolean>) => {
    setIsLoading(type);
    try {
      const success = await action();
      if (!success) {
        console.warn(`${type} failed`);
      }
    } catch (error) {
      console.error(`Error with ${type}:`, error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 ${className}`}>
        {/* Chromecast */}
        {capabilities.chromecast && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`p-1.5 h-auto ${actions.isCasting ? 'text-primary bg-primary/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                onClick={() => handleCast('chromecast', actions.startChromecast)}
                disabled={isLoading === 'chromecast'}
              >
                {isLoading === 'chromecast' ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Cast className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{actions.isCasting ? 'Transmitiendo a TV' : 'Transmitir a Chromecast'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* AirPlay */}
        {capabilities.airplay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="p-1.5 h-auto text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => handleCast('airplay', actions.startAirPlay)}
                disabled={isLoading === 'airplay'}
              >
                {isLoading === 'airplay' ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <MonitorSpeaker className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Transmitir con AirPlay</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Picture in Picture */}
        {capabilities.pictureInPicture && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`p-1.5 h-auto ${actions.isPictureInPicture ? 'text-primary bg-primary/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                onClick={() => handleCast('pip', actions.enterPictureInPicture)}
                disabled={isLoading === 'pip'}
              >
                {isLoading === 'pip' ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PictureInPicture2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{actions.isPictureInPicture ? 'Salir de PiP' : 'Picture in Picture'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Fullscreen */}
        {capabilities.fullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`p-1.5 h-auto ${actions.isFullscreen ? 'text-primary bg-primary/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
                onClick={() => handleCast(
                  'fullscreen', 
                  actions.isFullscreen ? actions.exitFullscreen : actions.enterFullscreen
                )}
                disabled={isLoading === 'fullscreen'}
              >
                {isLoading === 'fullscreen' ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : actions.isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{actions.isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Separador e indicador de transmisión */}
        {(capabilities.chromecast || capabilities.airplay) && actions.isCasting && (
          <div className="flex items-center gap-1 ml-1 px-2 py-1 bg-primary/20 rounded text-primary text-xs">
            <Tv className="w-3 h-3" />
            <span>En TV</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}