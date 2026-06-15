import React, { useMemo } from 'react';
import { useTheme } from './ThemeProvider';

export const ParticleBackground = () => {
  const { isEcoMode } = useTheme();

  const stars = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      cx: `${Math.random() * 100}%`,
      cy: `${Math.random() * 100}%`,
      r: Math.random() * 1.5 + 0.5,
      delay: `${Math.random() * 5}s`,
      duration: `${Math.random() * 4 + 3}s` // 3s to 7s
    }));
  }, []);

  if (isEcoMode) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-60">
      <svg className="w-full h-full">
        {stars.map((star) => (
          <circle
            key={star.id}
            cx={star.cx}
            cy={star.cy}
            r={star.r}
            className="sparkle-star"
            style={{
              animationDelay: star.delay,
              animationDuration: star.duration
            }}
          />
        ))}
      </svg>
      {/* Marble Texture Filter Wrapper */}
      <div className="marble-overlay fixed inset-0 pointer-events-none mix-blend-overlay"></div>
    </div>
  );
};
