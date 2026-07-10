"use client"

import React, { useEffect, useRef, ReactNode, useState } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean; // When true, ignores size prop and uses width/height or className
}

const glowColorMap = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
  gold: { base: 37, spread: 60 } // Osanchez Barbearia brand gold hue
};

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96'
};

const GlowCard: React.FC<GlowCardProps> = ({ 
  children, 
  className = '', 
  glowColor = 'gold',
  size = 'md',
  width,
  height,
  customSize = false
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Calculate pointer position relative to the viewport/document
      const rect = cardElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      cardElement.style.setProperty('--x', x.toFixed(2));
      cardElement.style.setProperty('--xp', (x / rect.width).toFixed(2));
      cardElement.style.setProperty('--y', y.toFixed(2));
      cardElement.style.setProperty('--yp', (y / rect.height).toFixed(2));
    };

    const handlePointerEnter = () => {
      setIsHovered(true);
      cardElement.style.setProperty('--bg-spot-opacity', '0.12');
      cardElement.style.setProperty('--border-spot-opacity', '1');
      cardElement.style.setProperty('--border-light-opacity', '1');
    };

    const handlePointerLeave = () => {
      setIsHovered(false);
      cardElement.style.setProperty('--bg-spot-opacity', '0');
      cardElement.style.setProperty('--border-spot-opacity', '0.15');
      cardElement.style.setProperty('--border-light-opacity', '0.1');
    };

    cardElement.addEventListener('pointermove', handlePointerMove);
    cardElement.addEventListener('pointerenter', handlePointerEnter);
    cardElement.addEventListener('pointerleave', handlePointerLeave);

    // Initial state setup for nice default ambient glow
    cardElement.style.setProperty('--x', (rect => rect ? rect.width / 2 : 100)(cardElement.getBoundingClientRect()).toString());
    cardElement.style.setProperty('--y', (rect => rect ? rect.height / 2 : 100)(cardElement.getBoundingClientRect()).toString());
    cardElement.style.setProperty('--xp', '0.5');
    cardElement.style.setProperty('--yp', '0.5');
    cardElement.style.setProperty('--bg-spot-opacity', '0');
    cardElement.style.setProperty('--border-spot-opacity', '0.25');
    cardElement.style.setProperty('--border-light-opacity', '0.15');

    return () => {
      cardElement.removeEventListener('pointermove', handlePointerMove);
      cardElement.removeEventListener('pointerenter', handlePointerEnter);
      cardElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  // Determine sizing
  const getSizeClasses = () => {
    if (customSize) {
      return ''; // Let className handle sizing
    }
    return sizeMap[size];
  };

  const getInlineStyles = () => {
    const baseStyles: React.CSSProperties = {
      // @ts-ignore
      '--base': base,
      '--spread': spread,
      '--radius': '16',
      '--border': '1.5',
      '--backdrop': 'var(--card)', // Connect seamlessly with global themes
      '--backup-border': 'var(--border)',
      '--size': '150',
      '--outer': '1',
      '--border-size': 'calc(var(--border, 1.5) * 1px)',
      '--spotlight-size': 'calc(var(--size, 150) * 1px)',
      '--hue': 'calc(var(--base) + (var(--xp, 0.5) * var(--spread, 60)))',
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 37) 100% 75% / var(--bg-spot-opacity, 0)), transparent
      )`,
      backgroundColor: 'var(--backdrop, transparent)',
      border: 'var(--border-size) solid var(--border)',
      position: 'relative',
      // Safe scrolling on mobile device touch inputs
      touchAction: 'pan-y',
    };

    if (width !== undefined) {
      baseStyles.width = typeof width === 'number' ? `${width}px` : width;
    }
    if (height !== undefined) {
      baseStyles.height = typeof height === 'number' ? `${height}px` : height;
    }

    return baseStyles;
  };

  const beforeAfterStyles = `
    .glow-card::before,
    .glow-card::after {
      pointer-events: none;
      content: "";
      position: absolute;
      inset: calc(var(--border-size) * -1);
      border: var(--border-size) solid transparent;
      border-radius: calc(var(--radius) * 1px);
      background-repeat: no-repeat;
      background-position: 50% 50%;
      mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      mask-clip: padding-box, border-box;
      mask-composite: intersect;
      -webkit-mask: linear-gradient(transparent, transparent), linear-gradient(white, white);
      -webkit-mask-clip: padding-box, border-box;
      -webkit-mask-composite: xor;
    }
    
    .glow-card::before {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.8) calc(var(--spotlight-size) * 0.8) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 37) 100% 65% / var(--border-spot-opacity, 0.25)), transparent 100%
      );
      filter: brightness(1.5);
    }
    
    .glow-card::after {
      background-image: radial-gradient(
        calc(var(--spotlight-size) * 0.4) calc(var(--spotlight-size) * 0.4) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(37 100% 85% / var(--border-light-opacity, 0.15)), transparent 100%
      );
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: beforeAfterStyles }} />
      <div
        ref={cardRef}
        className={`
          glow-card
          ${getSizeClasses()}
          rounded-2xl 
          relative 
          flex flex-col
          shadow-lg
          transition-all duration-300
          ${className}
        `}
        style={getInlineStyles()}
      >
        {children}
      </div>
    </>
  );
};

export { GlowCard }
