import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    chrome?: {
      cast?: {
        isAvailable: boolean;
        initialize: (
          apiConfig: any,
          onInitSuccess: () => void,
          onInitError: (error: any) => void
        ) => void;
        requestSession: (
          onSuccess: (session: any) => void,
          onError: (error: any) => void
        ) => void;
        ApiConfig: new (
          sessionRequest: any,
          sessionListener: (session: any) => void,
          receiverListener: (availability: any) => void,
          autoJoinPolicy?: any,
          defaultActionPolicy?: any
        ) => any;
        SessionRequest: new (appId: string) => any;
        AutoJoinPolicy: {
          ORIGIN_SCOPED: any;
        };
        DefaultActionPolicy: {
          CREATE_SESSION: any;
        };
        ReceiverAvailability: {
          AVAILABLE: any;
          UNAVAILABLE: any;
        };
        media: {
          MediaInfo: new (contentId: string, contentType: string) => any;
          LoadRequest: new (mediaInfo: any) => any;
        };
      };
    };
    WebKitPlaybackTargetAvailabilityEvent?: any;
  }
}

export interface CastingCapabilities {
  chromecast: boolean;
  airplay: boolean;
  pictureInPicture: boolean;
  fullscreen: boolean;
}

export interface CastingActions {
  startChromecast: () => Promise<boolean>;
  startAirPlay: () => Promise<boolean>;
  enterPictureInPicture: () => Promise<boolean>;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  isCasting: boolean;
}

export function useCasting(
  videoRef: React.RefObject<HTMLVideoElement>,
  streamUrl?: string
): [CastingCapabilities, CastingActions] {
  const [capabilities, setCapabilities] = useState<CastingCapabilities>({
    chromecast: false,
    airplay: false,
    pictureInPicture: false,
    fullscreen: false,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const castSessionRef = useRef<any>(null);

  // Detectar capacidades disponibles
  useEffect(() => {
    const detectCapabilities = () => {
      const newCapabilities: CastingCapabilities = {
        chromecast: false, // Se activará cuando Cast esté realmente disponible
        airplay: !!(window.WebKitPlaybackTargetAvailabilityEvent || 
                   'webkitShowPlaybackTargetPicker' in HTMLVideoElement.prototype),
        pictureInPicture: !!document.pictureInPictureEnabled,
        fullscreen: !!(document.fullscreenEnabled || 
                      (document as any).webkitFullscreenEnabled || 
                      (document as any).mozFullScreenEnabled),
      };
      setCapabilities(newCapabilities);
    };

    detectCapabilities();

    // Cargar Google Cast SDK si no está disponible
    if (!window.chrome?.cast && typeof window !== "undefined") {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.onload = () => {
        // Esperar a que Cast Framework esté disponible
        const checkCast = setInterval(() => {
          if (window.chrome?.cast?.isAvailable) {
            clearInterval(checkCast);
            initializeCast();
            setCapabilities(prev => ({ ...prev, chromecast: true }));
          }
        }, 100);
      };
      document.head.appendChild(script);
    } else if (window.chrome?.cast) {
      initializeCast();
    }
  }, []);

  // Inicializar Google Cast
  const initializeCast = useCallback(() => {
    if (!window.chrome?.cast) return;

    const sessionRequest = new window.chrome.cast.SessionRequest('CC1AD845'); // Default Media Receiver
    const apiConfig = new window.chrome.cast.ApiConfig(
      sessionRequest,
      (session: any) => {
        castSessionRef.current = session;
        setIsCasting(true);
      },
      (availability: any) => {
        setCapabilities(prev => ({
          ...prev,
          chromecast: availability === window.chrome?.cast?.ReceiverAvailability.AVAILABLE
        }));
      },
      window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      window.chrome.cast.DefaultActionPolicy.CREATE_SESSION
    );

    window.chrome.cast.initialize(
      apiConfig,
      () => console.log('Cast initialized'),
      (error: any) => console.warn('Cast initialization failed:', error)
    );
  }, []);

  // Monitorear estado de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || 
                     (document as any).webkitFullscreenElement || 
                     (document as any).mozFullScreenElement);
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Monitorear estado de Picture-in-Picture
  useEffect(() => {
    const handlePiPChange = () => {
      setIsPictureInPicture(!!document.pictureInPictureElement);
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('enterpictureinpicture', handlePiPChange);
    }
    document.addEventListener('leavepictureinpicture', handlePiPChange);

    return () => {
      if (video) {
        video.removeEventListener('enterpictureinpicture', handlePiPChange);
      }
      document.removeEventListener('leavepictureinpicture', handlePiPChange);
    };
  }, [videoRef]);

  // Funciones de casting
  const startChromecast = useCallback(async (): Promise<boolean> => {
    try {
      if (!window.chrome?.cast || !streamUrl) return false;

      return new Promise((resolve) => {
        window.chrome!.cast!.requestSession(
          (session: any) => {
            castSessionRef.current = session;
            const mediaInfo = new window.chrome!.cast!.media.MediaInfo(
              streamUrl,
              'application/vnd.apple.mpegurl'
            );
            const request = new window.chrome!.cast!.media.LoadRequest(mediaInfo);
            
            session.loadMedia(request,
              () => {
                setIsCasting(true);
                resolve(true);
              },
              (error: any) => {
                console.error('Error loading media:', error);
                resolve(false);
              }
            );
          },
          (error: any) => {
            console.error('Error requesting session:', error);
            resolve(false);
          }
        );
      });
    } catch (error) {
      console.error('Chromecast error:', error);
      return false;
    }
  }, [streamUrl]);

  const startAirPlay = useCallback(async (): Promise<boolean> => {
    try {
      const video = videoRef.current;
      if (!video) return false;

      // Para Safari/WebKit
      if ('webkitShowPlaybackTargetPicker' in video) {
        (video as any).webkitShowPlaybackTargetPicker();
        return true;
      }

      // Para navegadores que soportan Remote Playback API
      if ('remote' in video && (video as any).remote) {
        await (video as any).remote.prompt();
        return true;
      }

      return false;
    } catch (error) {
      console.error('AirPlay error:', error);
      return false;
    }
  }, [videoRef]);

  const enterPictureInPicture = useCallback(async (): Promise<boolean> => {
    try {
      const video = videoRef.current;
      if (!video || !document.pictureInPictureEnabled) return false;

      await video.requestPictureInPicture();
      return true;
    } catch (error) {
      console.error('Picture-in-Picture error:', error);
      return false;
    }
  }, [videoRef]);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const video = videoRef.current;
      if (!video) return false;

      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen();
      } else if ((video as any).mozRequestFullScreen) {
        (video as any).mozRequestFullScreen();
      } else {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Fullscreen error:', error);
      return false;
    }
  }, [videoRef]);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exit fullscreen error:', error);
      return false;
    }
  }, []);

  const actions: CastingActions = {
    startChromecast,
    startAirPlay,
    enterPictureInPicture,
    enterFullscreen,
    exitFullscreen,
    isFullscreen,
    isPictureInPicture,
    isCasting,
  };

  return [capabilities, actions];
}