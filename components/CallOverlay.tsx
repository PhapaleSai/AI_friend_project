'use client';

import Image from 'next/image';
import type { CharacterConfig } from '@/lib/characters';
import type { OrbState } from '@/lib/types';

interface CallOverlayProps {
  character: CharacterConfig;
  state: OrbState;
  /** Live 0–1 mic amplitude, used for the ring that reacts while you talk. */
  level: number;
  elapsedLabel: string;
  onEnd: () => void;
}

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'Connecting…',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export default function CallOverlay({ character, state, level, elapsedLabel, onEnd }: CallOverlayProps) {
  const accent = character.theme.primary;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between fade-in"
      style={{
        background: `radial-gradient(ellipse at 50% 25%, ${accent}22 0%, transparent 60%), rgba(7,7,15,0.97)`,
        backdropFilter: 'blur(20px)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
      }}
    >
      {/* Who you're on with */}
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <p className="text-[0.8125rem] font-medium tracking-wide" style={{ color: `${accent}cc` }}>
          {elapsedLabel}
        </p>
        <h2 className="text-2xl font-bold text-white">{character.name}</h2>
        <p className="text-[0.875rem] text-slate-400">{STATE_LABEL[state]}</p>
      </div>

      {/* Avatar with a ring that breathes on your voice */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full pointer-events-none transition-transform duration-100"
          style={{
            width: '15rem',
            height: '15rem',
            border: `2px solid ${accent}40`,
            // Listening tracks the mic; speaking pulses on its own so the
            // circle never sits dead still while the character talks.
            transform: `scale(${state === 'listening' ? 1 + level * 0.28 : 1})`,
            animation: state === 'speaking' ? 'pulse-slow 1.6s ease-in-out infinite' : undefined,
          }}
        />
        <div
          className="absolute rounded-full blur-2xl pointer-events-none"
          style={{
            width: '17rem',
            height: '17rem',
            background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
            opacity: state === 'thinking' ? 0.5 : 0.9,
          }}
        />
        <div
          className="relative rounded-full overflow-hidden"
          style={{
            width: '11rem',
            height: '11rem',
            border: `2px solid ${accent}55`,
            boxShadow: `0 0 48px ${accent}40`,
          }}
        >
          <Image
            src={character.avatar}
            alt={character.name}
            fill
            sizes="11rem"
            className="object-cover"
            style={{ objectPosition: character.avatarPosition }}
            unoptimized={character.isCustom}
          />
        </div>
      </div>

      {/* Hang up */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onEnd}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all
                     duration-200 active:scale-90 focus:outline-none"
          style={{ background: '#ef4444', boxShadow: '0 8px 28px rgba(239,68,68,0.45)' }}
          aria-label="End call"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white" style={{ transform: 'rotate(135deg)' }}>
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </button>
        <p className="text-[0.75rem] text-slate-600">Just talk — it sends when you pause</p>
      </div>
    </div>
  );
}
