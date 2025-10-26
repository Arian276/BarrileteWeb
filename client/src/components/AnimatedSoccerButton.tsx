import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";

interface AnimatedSoccerButtonProps {
  streamId: string;
  className?: string;
}

export function AnimatedSoccerButton({ streamId, className = "" }: AnimatedSoccerButtonProps) {
  const ballRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const animationRef = useRef<number>();


  return (
    <Link to={`/stream/${streamId}`}>
      <div 
        className={`relative flex items-center justify-center p-6 cursor-pointer group ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid={`button-watch-${streamId}`}
      >
        {}
        <div
          ref={ballRef}
          className="relative"
          style={{
            width: '200px',
            height: '60px',
            background: isHovered ? 
              'linear-gradient(135deg, #ff6b6b, #ff8e53, #ff6b6b)' : 
              'linear-gradient(135deg, #4ecdc4, #44a08d, #4ecdc4)',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.3s ease',
            boxShadow: isHovered ? 
              '0 15px 30px rgba(255, 107, 107, 0.4)' : 
              '0 8px 20px rgba(78, 205, 196, 0.3)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: isHovered ? '100%' : '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              transition: 'left 0.6s ease'
            }}
          />

          {}
          <div 
            className="flex items-center gap-3 text-white font-bold text-lg z-10"
            data-testid={`button-text-${streamId}`}
          >
            <span>▶</span>
            <span>VER AHORA</span>
            <div 
              className="w-6 h-6 rounded-full bg-white bg-opacity-20 flex items-center justify-center"
              style={{
                transform: isHovered ? 'translateX(5px)' : 'translateX(0px)',
                transition: 'transform 0.3s ease'
              }}
            >
              <span className="text-sm">→</span>
            </div>
          </div>

          {}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), 
                          radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
              opacity: isHovered ? 0.8 : 0.4,
              transition: 'opacity 0.3s ease'
            }}
          />
        </div>

        {}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: isHovered ? 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)' : 'none',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
            animation: isHovered ? 'pulse 2s ease-in-out infinite' : 'none'
          }}
        />
      </div>
    </Link>
  );
}