'use client';

const MOODS: { label: string; emoji: string; value: string }[] = [
  { label: 'Happy', emoji: '😃', value: 'Happy' },
  { label: 'Stressed', emoji: '😫', value: 'Stressed' },
  { label: 'Hyped', emoji: '🚀', value: 'Hyped' },
  { label: 'Bored', emoji: '🥱', value: 'Bored' },
];

interface MoodSelectorProps {
  onSelect: (mood: string) => void;
  onSkip: () => void;
}

export default function MoodSelector({ onSelect, onSkip }: MoodSelectorProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(7,7,15,0.72)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="bounce-in w-full max-w-[340px] rounded-3xl px-6 py-7 text-center"
        style={{
          background: 'rgba(20,20,32,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <h3 className="text-lg font-bold text-white mb-1">How are you feeling?</h3>
        <p className="text-slate-400 text-xs mb-5">This helps set the right vibe for our chat</p>

        <div className="grid grid-cols-2 gap-2.5">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => onSelect(m.value)}
              className="flex flex-col items-center gap-1.5 py-4 rounded-2xl transition-all duration-200
                         hover:scale-105 active:scale-95 focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className="text-xs font-semibold text-slate-300">{m.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onSkip}
          className="mt-5 text-xs text-slate-600 hover:text-slate-400 transition-colors focus:outline-none"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
