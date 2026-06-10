'use client';

import Image from 'next/image';
import { CHARACTERS, type CharacterId, type CharacterConfig } from '@/lib/characters';

interface CharacterSelectorProps {
  selected: CharacterId;
  onChange: (id: CharacterId) => void;
}

function CharacterCard({
  character,
  isActive,
  onClick,
}: {
  character: CharacterConfig;
  isActive: boolean;
  onClick: () => void;
}) {
  const { theme } = character;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 px-3 py-2 rounded-2xl transition-all duration-300 focus:outline-none"
      style={{
        background: isActive ? theme.tabActive : 'transparent',
        border: `1px solid ${isActive ? theme.primary + '50' : 'transparent'}`,
        boxShadow: isActive
          ? `0 0 18px ${theme.primary}25, inset 0 1px 0 rgba(255,255,255,0.06)`
          : 'none',
        transform: isActive ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Avatar with glow ring */}
      <div className="relative flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full overflow-hidden transition-all duration-300"
          style={{
            boxShadow: isActive
              ? `0 0 0 2px ${theme.primary}, 0 0 14px ${theme.primary}70`
              : `0 0 0 1.5px rgba(255,255,255,0.15)`,
          }}
        >
          <Image
            src={character.avatar}
            alt={character.name}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            style={{ objectPosition: character.avatarPosition }}
          />
        </div>
        {/* Online dot */}
        <div
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: isActive ? theme.primary : '#374151',
            borderColor: '#07070f',
            boxShadow: isActive ? `0 0 6px ${theme.primary}` : 'none',
          }}
        />
      </div>

      {/* Name + subtitle */}
      <div className="text-left">
        <p
          className="text-sm font-semibold leading-none transition-colors duration-200"
          style={{ color: isActive ? theme.primary : '#94a3b8' }}
        >
          {character.name}
        </p>
        <p className="text-[10px] text-slate-600 mt-0.5">{character.title}</p>
      </div>
    </button>
  );
}

export default function CharacterSelector({ selected, onChange }: CharacterSelectorProps) {
  return (
    <div
      className="flex items-center p-1 rounded-2xl gap-1"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {(Object.values(CHARACTERS) as CharacterConfig[]).map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          isActive={selected === character.id}
          onClick={() => onChange(character.id)}
        />
      ))}
    </div>
  );
}
