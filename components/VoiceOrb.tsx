'use client';

import type { OrbState } from '@/lib/types';
import type { CharacterTheme } from '@/lib/characters';

interface VoiceOrbProps {
  state: OrbState;
  theme: CharacterTheme;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = { sm: 52, md: 104, lg: 148 };

export default function VoiceOrb({ state, theme, onClick, size = 'lg' }: VoiceOrbProps) {
  const px = SIZE_MAP[size];

  const orbBg = (() => {
    switch (state) {
      case 'listening': return theme.orbListening;
      case 'thinking':  return theme.orbThinking;
      case 'speaking':  return theme.orbSpeaking;
      default:          return theme.orbIdle;
    }
  })();

  const orbGlow = (() => {
    switch (state) {
      case 'listening': return theme.orbGlowListening;
      case 'speaking':  return theme.orbGlowSpeaking;
      default:          return theme.orbGlowIdle;
    }
  })();

  const numRipples = state === 'listening' ? 3 : state === 'speaking' ? 2 : 0;

  return (
    <div
      className={state === 'idle' ? 'animate-float' : ''}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Burst rings (listening / speaking) */}
      {numRipples > 0 && Array.from({ length: numRipples }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: px,
            height: px,
            border: `1.5px solid ${theme.primary}55`,
            animation: `ripple ${state === 'listening' ? 1.8 : 2.4}s ease-out ${i * 0.55}s infinite`,
          }}
        />
      ))}

      {/* Outer ambient halo */}
      <div className="absolute rounded-full blur-2xl pointer-events-none transition-all duration-700"
        style={{
          width: px * 1.6,
          height: px * 1.6,
          background: `radial-gradient(circle, ${theme.primary}35 0%, transparent 70%)`,
          opacity: state === 'idle' ? 0.5 : 0.85,
          animation: state !== 'idle' ? `pulse-slow 2s ease-in-out infinite` : undefined,
        }} />

      {/* Spinning ring (thinking) */}
      {state === 'thinking' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: px + 12,
            height: px + 12,
            border: `2px solid transparent`,
            borderTopColor: theme.primary,
            borderRightColor: theme.secondary,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
      )}

      {/* Second spinning ring opposite (thinking) */}
      {state === 'thinking' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: px + 22,
            height: px + 22,
            border: `1.5px solid transparent`,
            borderBottomColor: theme.primary + '70',
            borderLeftColor: theme.secondary + '50',
            borderRadius: '50%',
            animation: 'spin 1.8s linear infinite reverse',
          }} />
      )}

      {/* Main orb */}
      <button
        onClick={onClick}
        className="relative rounded-full flex items-center justify-center overflow-hidden focus:outline-none"
        style={{
          width: px,
          height: px,
          background: orbBg,
          boxShadow: orbGlow,
          transform: state === 'listening' ? 'scale(1.12)' : state === 'speaking' ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease',
          animation: state === 'idle'
            ? 'pulse-slow 4s ease-in-out infinite'
            : state === 'listening'
            ? 'pulse-fast 0.7s ease-in-out infinite'
            : undefined,
        }}
        aria-label={state === 'listening' ? 'Stop listening' : 'Click to speak'}
      >
        {/* Gloss highlight */}
        <div className="absolute rounded-full blur-sm pointer-events-none"
          style={{
            top: '12%', left: '18%',
            width: '38%', height: '38%',
            background: 'rgba(255,255,255,0.30)',
          }} />

        {/* Bottom subtle reflection */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            bottom: '15%', right: '20%',
            width: '20%', height: '20%',
            background: 'rgba(255,255,255,0.10)',
            filter: 'blur(4px)',
          }} />

        {/* Icon content */}
        <div className="relative z-10 flex items-center justify-center">
          {state === 'idle' && (
            <svg width={px * 0.24} height={px * 0.24} viewBox="0 0 24 24" fill="white" className="drop-shadow-lg">
              <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}

          {(state === 'listening' || state === 'speaking') && (
            <div className="flex items-end gap-[3px]" style={{ height: px * 0.22 }}>
              {[0, 0.10, 0.22, 0.34, 0.46].map((delay, i) => (
                <span key={i} className="wave-bar bg-white" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
          )}

          {state === 'thinking' && (
            <div className="flex gap-1.5 items-center">
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} className="rounded-full bg-white"
                  style={{
                    width: px * 0.1,
                    height: px * 0.1,
                    animation: `typing-dot 1.1s ease-in-out ${d}s infinite`,
                  }} />
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
