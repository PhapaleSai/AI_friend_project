'use client';

import Image from 'next/image';
import type { CharacterId, CharacterConfig } from '@/lib/characters';

interface CharacterSheetProps {
  characters: CharacterConfig[];
  selected: CharacterId;
  onChange: (id: CharacterId) => void;
  onCreateNew: () => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

/**
 * Phone-sized character switcher. The inline selector shows every character
 * side by side, which is fine on a laptop but leaves each card a sliver wide
 * on a phone — this gives them a full-width tappable row instead.
 */
export default function CharacterSheet({
  characters, selected, onChange, onCreateNew, onDelete, onClose,
}: CharacterSheetProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(7,7,15,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] rounded-t-3xl px-3 pt-3"
        style={{
          background: 'rgba(20,20,32,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.6)',
          paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))',
          animation: 'slide-up 0.28s cubic-bezier(0.16,1,0.3,1) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.2)' }} />

        <div className="max-h-[60vh] overflow-y-auto">
          {characters.map((c) => {
            const isActive = c.id === selected;
            return (
              <div
                key={c.id}
                onClick={() => { onChange(c.id); onClose(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl mb-1 cursor-pointer transition-all duration-150"
                style={{
                  background: isActive ? c.theme.tabActive : 'transparent',
                  border: `1px solid ${isActive ? c.theme.primary + '50' : 'transparent'}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    boxShadow: isActive
                      ? `0 0 0 2px ${c.theme.primary}, 0 0 14px ${c.theme.primary}60`
                      : '0 0 0 1.5px rgba(255,255,255,0.15)',
                  }}
                >
                  <Image
                    src={c.avatar}
                    alt={c.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: c.avatarPosition }}
                    unoptimized={c.isCustom}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-[1.0000rem] font-semibold leading-tight truncate"
                    style={{ color: isActive ? c.theme.primary : '#e2e8f0' }}
                  >
                    {c.name}
                  </p>
                  <p className="text-[0.8125rem] text-slate-500 truncate">{c.title}</p>
                </div>

                {isActive && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={c.theme.primary} className="flex-shrink-0">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                )}

                {c.isCustom && onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors focus:outline-none"
                    title="Delete this character"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { onCreateNew(); onClose(); }}
          className="w-full mt-2 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[0.9375rem] font-semibold text-slate-300 transition-all duration-150 active:scale-95 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.18)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Create your own
        </button>
      </div>
    </div>
  );
}
