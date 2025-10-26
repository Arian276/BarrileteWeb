import { forwardRef, useState, useRef, useEffect } from "react";
import { Button, ButtonProps } from "@/components/ui/button";

interface InteractiveButtonProps extends ButtonProps {
  rippleColor?: string;
  glowEffect?: boolean;
  pulseOnClick?: boolean;
  argentineTheme?: boolean;
}

const InteractiveButton = forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  ({ 
    children, 
    className = "",
    rippleColor = "rgba(255, 255, 255, 0.3)",
    glowEffect = false,
    pulseOnClick = true,
    argentineTheme = false,
    onClick,
    ...props 
  }, ref) => {
    const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
    const [isPressed, setIsPressed] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const rippleIdCounter = useRef(0);

    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const newRipple = {
        id: rippleIdCounter.current++,
        x,
        y
      };

      setRipples(prev => [...prev, newRipple]);

      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
      }, 600);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      
      createRipple(event);
      
      if (pulseOnClick) {
        setIsPressed(true);
        setShowFeedback(true);
        
        setTimeout(() => {
          setIsPressed(false);
          setShowFeedback(false);
        }, 150);
      }

      if (onClick) {
        onClick(event);
      }
    };

    const enhancedClassName = `
      ${className}
      ${argentineTheme ? 'argentina-gradient text-white' : ''}
      ${glowEffect ? 'glow-celeste' : ''}
      ${isPressed ? 'scale-95' : ''}
      ${showFeedback ? 'animate-pulse' : ''}
      button-click-effect enhanced-hover
      transition-all duration-150
      relative overflow-hidden
      transform-gpu
    `.trim().replace(/\s+/g, ' ');

    return (
      <Button
        ref={ref || buttonRef}
        className={enhancedClassName}
        onClick={handleClick}
        {...props}
      >
        {}
        <div className="absolute inset-0 pointer-events-none">
          {ripples.map((ripple) => (
            <div
              key={ripple.id}
              className="absolute rounded-full animate-ping opacity-75"
              style={{
                left: ripple.x - 10,
                top: ripple.y - 10,
                width: 20,
                height: 20,
                backgroundColor: rippleColor,
                animation: 'ripple-expand 0.6s linear'
              }}
            />
          ))}
        </div>

        {}
        {showFeedback && (
          <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-600/20 rounded-md animate-fade-in-scale" />
        )}

        {}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </div>

        {}
        {argentineTheme && (
          <div className="absolute inset-0 bg-gradient-to-r from-argentina-celeste/10 via-argentina-orange/10 to-argentina-energy/10 rounded-md pointer-events-none" />
        )}
      </Button>
    );
  }
);

InteractiveButton.displayName = "InteractiveButton";

export default InteractiveButton;