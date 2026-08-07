'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { createCustomCharacter, importCharacterCode, type CustomCharacterInput } from '@/lib/customCharacters';
import type { CharacterConfig } from '@/lib/characters';

interface CharacterCreatorProps {
  onCreated: (character: CharacterConfig) => void;
  onClose: () => void;
}

const COLOR_PRESETS: [string, string][] = [
  ['#8b5cf6', '#ec4899'],
  ['#f97316', '#eab308'],
  ['#0ea5e9', '#22d3ee'],
  ['#14b8a6', '#5eead4'],
  ['#ef4444', '#f97316'],
  ['#a855f7', '#6366f1'],
];

function resizeImageToDataUrl(file: File, size = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = document.createElement('img');
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas unsupported')); return; }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function CharacterCreator({ onCreated, onClose }: CharacterCreatorProps) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [gender, setGender] = useState<'female' | 'male'>('female');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'create' | 'import'>('create');
  const [importCode, setImportCode] = useState('');

  const handleImport = () => {
    const config = importCharacterCode(importCode);
    if (!config) {
      setError('That code isn\'t valid. Make sure you copied the whole thing.');
      return;
    }
    onCreated(config);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setAvatarDataUrl(await resizeImageToDataUrl(file));
    } catch {
      setError('Could not load that image — try another one.');
    }
  };

  const canCreate = name.trim().length > 0 && systemPrompt.trim().length > 10 && avatarDataUrl;

  const handleCreate = () => {
    if (!canCreate) {
      setError('Give your character a name, an avatar, and a personality description.');
      return;
    }
    const input: CustomCharacterInput = {
      name: name.trim(),
      tagline: tagline.trim() || 'Your custom AI friend',
      systemPrompt: systemPrompt.trim(),
      avatarDataUrl,
      primaryColor: COLOR_PRESETS[colorIdx][0],
      secondaryColor: COLOR_PRESETS[colorIdx][1],
      gender,
      rate: 1.0,
      pitch: gender === 'female' ? 1.2 : 0.85,
    };
    const config = createCustomCharacter(input);
    onCreated(config);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 sm:px-6"
      style={{
        background: 'rgba(7,7,15,0.72)',
        backdropFilter: 'blur(8px)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        className="scale-in w-full max-w-[440px] max-h-[88vh] overflow-y-auto rounded-3xl px-5 py-6"
        style={{
          background: 'rgba(20,20,32,0.94)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {tab === 'create' ? 'Create your AI friend' : 'Import a friend'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors focus:outline-none">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['create', 'import'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-150 focus:outline-none"
              style={{
                background: tab === t ? 'rgba(255,255,255,0.09)' : 'transparent',
                color: tab === t ? '#fff' : '#64748b',
              }}
            >
              {t === 'create' ? 'Create new' : 'Import code'}
            </button>
          ))}
        </div>

        {tab === 'import' ? (
          <>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Paste a share code someone sent you. Their character — personality, voice and look — gets added to your list.
            </p>
            <textarea
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setError(''); }}
              placeholder="FRIENDAI1:..."
              rows={5}
              className="w-full mb-4 px-3 py-2.5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none resize-none font-mono break-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 focus:outline-none disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${COLOR_PRESETS[0][0]}, ${COLOR_PRESETS[0][1]})` }}
            >
              Import &amp; start chatting
            </button>
          </>
        ) : (
        <>
        {/* Avatar upload */}
        <div className="flex flex-col items-center mb-5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.18)' }}
          >
            {avatarDataUrl ? (
              <Image src={avatarDataUrl} alt="avatar" width={96} height={96} className="w-full h-full object-cover" unoptimized />
            ) : (
              <span className="text-slate-500 text-xs px-2 text-center">Tap to<br />upload photo</span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riya"
          maxLength={20}
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Tagline</label>
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Your chill study buddy"
          maxLength={40}
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Personality &amp; how they talk</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Describe their personality, how they text, what they're into..."
          rows={4}
          className="w-full mb-4 px-3 py-2.5 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none resize-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        />

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Voice</label>
        <div className="flex gap-1.5 mb-4">
          {(['female', 'male'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className="px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all duration-150 focus:outline-none"
              style={{
                background: gender === g ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${gender === g ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.08)'}`,
                color: gender === g ? '#c084fc' : '#94a3b8',
              }}
            >
              {g}
            </button>
          ))}
        </div>

        <label className="block text-xs font-semibold text-slate-400 mb-1.5">Theme color</label>
        <div className="flex gap-2 mb-5">
          {COLOR_PRESETS.map(([p, s], i) => (
            <button
              key={i}
              onClick={() => setColorIdx(i)}
              className="w-8 h-8 rounded-full flex-shrink-0 transition-transform duration-150"
              style={{
                background: `linear-gradient(135deg, ${p}, ${s})`,
                transform: colorIdx === i ? 'scale(1.15)' : 'scale(1)',
                boxShadow: colorIdx === i ? `0 0 0 2px #fff, 0 0 12px ${p}` : 'none',
              }}
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <button
          onClick={handleCreate}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 focus:outline-none"
          style={{
            background: `linear-gradient(135deg, ${COLOR_PRESETS[colorIdx][0]}, ${COLOR_PRESETS[colorIdx][1]})`,
            boxShadow: `0 4px 16px ${COLOR_PRESETS[colorIdx][0]}40`,
          }}
        >
          Create &amp; start chatting
        </button>
        </>
        )}
      </div>
    </div>
  );
}
