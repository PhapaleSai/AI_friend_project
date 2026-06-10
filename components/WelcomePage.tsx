'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { CHARACTERS, type CharacterId, type CharacterConfig } from '@/lib/characters';

const NAME_KEY = 'friend-ai-username';

interface WelcomePageProps {
  onSelect: (id: CharacterId, name: string) => void;
}

/* ─── Floating particles ─────────────────────────────────────── */
interface Particle { id: number; x: number; size: number; color: string; dur: number; delay: number; sway: number; }

function Particles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    const colors = ['#c084fc', '#f97316', '#ec4899', '#818cf8', '#fb923c', '#a855f7'];
    setParticles(
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        size: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        dur: Math.random() * 8 + 5,
        delay: Math.random() * 10,
        sway: (Math.random() - 0.5) * 60,
      }))
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            '--dur':   `${p.dur}s`,
            '--delay': `${p.delay}s`,
            '--sway':  `${p.sway}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Character card ─────────────────────────────────────────── */
function CharacterCard({ character, onSelect, index, disabled }: {
  character: CharacterConfig;
  onSelect: () => void;
  index: number;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <div
      ref={cardRef}
      className="relative flex-1 min-w-0 cursor-pointer select-none"
      style={{
        animation: `slide-up 0.7s ${300 + index * 160}ms cubic-bezier(0.16,1,0.3,1) both`,
        opacity: disabled ? 0.4 : 1,
        transition: 'opacity 0.3s ease',
      }}
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMousePos({ x: 0.5, y: 0.5 }); }}
      onMouseMove={handleMouseMove}
    >
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-3xl blur-2xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${character.theme.primary}40, transparent 70%)`,
          opacity: hovered ? 1 : 0.35,
          transform: hovered ? 'scale(1.06)' : 'scale(1)',
        }} />

      {/* Animated gradient border (always spinning) */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          padding: 1.5,
          background: hovered
            ? `conic-gradient(from calc(var(--a, 0deg)), ${character.theme.primary}, ${character.theme.secondary}, ${character.theme.primary})`
            : `conic-gradient(from 0deg, ${character.theme.primary}40, ${character.theme.secondary}20, ${character.theme.primary}40)`,
          borderRadius: '1.5rem',
          animation: hovered ? 'border-spin 2.5s linear infinite' : 'border-spin 8s linear infinite',
        }}>
        <div className="absolute inset-0 rounded-3xl" style={{ background: '#0d0d1a' }} />
      </div>

      {/* Card body */}
      <div
        className="relative rounded-3xl overflow-hidden flex flex-col items-center transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse at ${mousePos.x * 100}% ${mousePos.y * 100}%, ${character.theme.primary}12 0%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.02) 100%)`,
          backdropFilter: 'blur(30px)',
          transform: hovered ? 'translateY(-12px)' : 'translateY(0)',
          boxShadow: hovered
            ? `0 32px 80px -8px ${character.theme.primary}40, 0 0 0 1px ${character.theme.primary}30`
            : '0 8px 32px -8px rgba(0,0,0,0.7)',
          padding: '2rem 1.5rem 1.75rem',
          gap: '1.25rem',
        }}
      >
        {/* Shimmer sweep */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
            transform: hovered ? 'translateX(100%)' : 'translateX(-100%)',
            transition: 'transform 0.65s ease',
          }} />

        {/* Portrait */}
        <div className="relative">
          {/* Rotating conic ring */}
          <div className="absolute inset-[-4px] rounded-full"
            style={{
              background: `conic-gradient(from 0deg, ${character.theme.primary}, ${character.theme.secondary}, transparent 60%, ${character.theme.primary})`,
              borderRadius: '50%',
              animation: hovered ? 'spin 2s linear infinite' : 'spin 6s linear infinite',
              opacity: hovered ? 0.9 : 0.5,
            }} />
          {/* Glow halo */}
          <div className="absolute inset-[-8px] rounded-full blur-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${character.theme.primary}50, transparent 70%)`,
              opacity: hovered ? 0.8 : 0.3,
              transition: 'opacity 0.5s',
            }} />
          {/* Photo */}
          <div className="relative rounded-full overflow-hidden transition-transform duration-500"
            style={{ width: 120, height: 120, transform: hovered ? 'scale(1.06)' : 'scale(1)' }}>
            <Image src={character.avatar} alt={character.name} width={120} height={120}
              className="w-full h-full object-cover"
              style={{ objectPosition: character.avatarPosition }}
              priority />
          </div>
          {/* Online badge */}
          <div className="absolute bottom-0 right-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{
              background: `${character.theme.primary}30`, border: `1px solid ${character.theme.primary}60`,
              color: character.theme.primary, backdropFilter: 'blur(8px)',
            }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: character.theme.primary }} />
            ONLINE
          </div>
        </div>

        {/* Name */}
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tight transition-all duration-300 animate-gradient-text"
            style={{
              background: hovered
                ? `linear-gradient(135deg, ${character.theme.primary}, ${character.theme.secondary}, ${character.theme.primary})`
                : `linear-gradient(135deg, white, rgba(255,255,255,0.75))`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
            }}>
            {character.name}
          </h3>
          <p className="text-xs font-semibold uppercase tracking-widest mt-1"
            style={{ color: character.theme.primary + 'aa' }}>
            {character.title}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${character.theme.primary}60, transparent)` }} />

        {/* Trait pills */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {character.subtitle.split(' · ').map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-300"
              style={{
                background: `${character.theme.primary}${hovered ? '25' : '12'}`,
                border: `1px solid ${character.theme.primary}${hovered ? '50' : '25'}`,
                color: character.theme.nameColor,
                transform: hovered ? 'scale(1.03)' : 'scale(1)',
              }}>
              {t}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2
                     transition-all duration-300 focus:outline-none active:scale-95 relative overflow-hidden"
          style={{
            background: hovered
              ? `linear-gradient(135deg, ${character.theme.primary}, ${character.theme.secondary})`
              : `linear-gradient(135deg, ${character.theme.primary}50, ${character.theme.secondary}28)`,
            boxShadow: hovered ? `0 8px 28px ${character.theme.primary}55` : 'none',
            border: `1px solid ${character.theme.primary}${hovered ? '00' : '35'}`,
          }}>
          {/* Button shimmer on hover */}
          {hovered && (
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                animation: 'shimmer-sweep 1.5s ease-in-out infinite',
              }} />
          )}
          Chat with {character.name}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
            style={{ transform: hovered ? 'translateX(4px)' : 'none', transition: 'transform 0.3s' }}>
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function WelcomePage({ onSelect }: WelcomePageProps) {
  const [ready, setReady]               = useState(false);
  const [name, setName]                 = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY) ?? '';
    if (saved) { setName(saved); setNameSubmitted(true); }
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const handleNameSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) { inputRef.current?.focus(); return; }
    localStorage.setItem(NAME_KEY, trimmed);
    setNameSubmitted(true);
  };

  const handleSelect = (id: CharacterId) => {
    const trimmed = name.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    localStorage.setItem(NAME_KEY, trimmed);
    onSelect(id, trimmed);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{ background: '#07070f' }}>

      {/* ── Moving aurora blobs ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute aurora-1" style={{
          width: 900, height: 900, top: '-30%', left: '-25%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }} />
        <div className="absolute aurora-2" style={{
          width: 800, height: 800, bottom: '-30%', right: '-20%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 65%)',
          filter: 'blur(50px)',
        }} />
        <div className="absolute aurora-3" style={{
          width: 500, height: 500, top: '20%', left: '35%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
      </div>

      {/* ── Grid ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.022]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />

      {/* ── Floating particles ── */}
      <Particles />

      {/* ── Hero text ── */}
      <div className="relative z-10 text-center mb-8"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(-24px)',
          transition: 'all 0.9s cubic-bezier(0.16,1,0.3,1)',
        }}>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex -space-x-2">
            {(['naina', 'bunny'] as CharacterId[]).map((id) => (
              <div key={id} className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-black/50">
                <Image src={CHARACTERS[id].avatar} alt={id} width={20} height={20}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: CHARACTERS[id].avatarPosition }} />
              </div>
            ))}
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Friend AI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Animated gradient title */}
        <h1 className="font-black leading-[1.05] tracking-tight" style={{ fontSize: 'clamp(2.6rem, 7vw, 4.5rem)' }}>
          <span style={{
            background: 'linear-gradient(135deg, #ffffff, rgba(255,255,255,0.65))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Your AI
          </span>
          <br />
          <span className="animate-gradient-text" style={{
            background: 'linear-gradient(135deg, #f9a8d4, #c084fc, #fb923c, #fbbf24, #c084fc)',
            backgroundSize: '300% 300%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Companions
          </span>
        </h1>

        <p className="text-slate-400 mt-3 text-base max-w-xs mx-auto leading-relaxed"
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.8s 0.3s' }}>
          Talk, laugh & learn — like they&apos;re really there
        </p>
      </div>

      {/* ── Name input ── */}
      <div className="relative z-10 w-full max-w-[380px] mb-7"
        style={{
          opacity: ready ? 1 : 0,
          transform: ready ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}>
        {nameSubmitted ? (
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={() => setNameSubmitted(false)}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #c084fc, #f97316)', color: 'white' }}>
                {name.trim()[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">{name.trim()}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">tap to change</p>
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-slate-600">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
        ) : (
          <div>
            <p className="text-slate-400 text-sm text-center mb-2.5">
              {name ? `Hi ${name.trim()}! 👋` : 'What should we call you?'}
            </p>
            <div className="flex items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
              }}>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                placeholder="Your name..."
                autoFocus
                maxLength={24}
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 focus:outline-none px-2 py-1.5"
              />
              <button onClick={handleNameSubmit} disabled={!name.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200 focus:outline-none active:scale-95"
                style={{
                  background: name.trim() ? 'linear-gradient(135deg, #c084fc, #f97316)' : 'rgba(255,255,255,0.06)',
                  color: name.trim() ? 'white' : '#475569',
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: name.trim() ? '0 4px 16px rgba(192,132,252,0.4)' : 'none',
                }}>
                Let&apos;s go →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Character cards ── */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 w-full max-w-[580px]">
        {(Object.values(CHARACTERS) as CharacterConfig[]).map((char, i) => (
          <CharacterCard
            key={char.id}
            character={char}
            onSelect={() => handleSelect(char.id)}
            index={i}
            disabled={!nameSubmitted}
          />
        ))}
      </div>

      {!nameSubmitted && (
        <p className="relative z-10 mt-5 text-slate-600 text-xs animate-pulse">
          Enter your name above to start chatting
        </p>
      )}

      {/* ── Footer ── */}
      <div className="relative z-10 mt-8 flex flex-col items-center gap-1.5"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1s 0.9s' }}>
        <p className="text-slate-600 text-xs tracking-wide">
          ✦ Inspired by <span className="text-slate-500 font-medium">Yeh Jawaani Hai Deewani</span> ✦
        </p>
        <p className="text-slate-700 text-[11px] font-medium">
          😊 All Copyrights owned by Sai 😊
        </p>
      </div>
    </div>
  );
}
