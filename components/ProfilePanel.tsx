'use client';

import { useState } from 'react';
import type { UserProfile } from '@/lib/profile';
import { TONE_LABELS } from '@/lib/profile';

interface ProfilePanelProps {
  profile: UserProfile;
  facts: string[];
  characterName: string;
  accentColor: string;
  onSave: (profile: UserProfile) => void;
  onDeleteFact: (index: number) => void;
  onClose: () => void;
}

export default function ProfilePanel({
  profile, facts, characterName, accentColor, onSave, onDeleteFact, onClose,
}: ProfilePanelProps) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [birthday, setBirthday] = useState(profile.birthday);
  const [tone, setTone] = useState(profile.tone);

  const handleSave = () => {
    onSave({ nickname: nickname.trim(), birthday, tone });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 pb-3 sm:px-6"
      style={{ background: 'rgba(7,7,15,0.72)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="scale-in w-full max-w-[420px] max-h-[85vh] overflow-y-auto rounded-3xl px-5 py-6"
        style={{
          background: 'rgba(20,20,32,0.94)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Your profile</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors focus:outline-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nickname</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="What should we call you?"
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Birthday</label>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm text-white focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
        />

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tone style</label>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {(Object.keys(TONE_LABELS) as UserProfile['tone'][]).map((t) => (
            <button
              key={t}
              onClick={() => setTone(t)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 focus:outline-none"
              style={{
                background: tone === t ? `${accentColor}25` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${tone === t ? accentColor + '60' : 'rgba(255,255,255,0.08)'}`,
                color: tone === t ? accentColor : '#94a3b8',
              }}
            >
              {TONE_LABELS[t]}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
          What {characterName} remembers about you
        </label>
        {facts.length === 0 ? (
          <p className="text-xs text-slate-600 mb-5">Nothing remembered yet — keep chatting and it'll pick things up.</p>
        ) : (
          <div className="flex flex-col gap-1.5 mb-5">
            {facts.map((fact, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-slate-300"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="flex-1">{fact}</span>
                <button
                  onClick={() => onDeleteFact(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 focus:outline-none"
                  title="Forget this"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 focus:outline-none"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`, boxShadow: `0 4px 16px ${accentColor}40` }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
