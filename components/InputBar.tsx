'use client';

import { useRef, useEffect, useState, KeyboardEvent, PointerEvent } from 'react';

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onRecordStart: () => void;
  onRecordStop: () => void;
  isRecording: boolean;
  waveLevel: number;
  isDisabled: boolean;
  voiceSupported: boolean;
  accentColor?: string;
}

export default function InputBar({
  value,
  onChange,
  onSend,
  onRecordStart,
  onRecordStop,
  isRecording,
  waveLevel,
  isDisabled,
  voiceSupported,
  accentColor = '#8b5cf6',
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [levels, setLevels] = useState<number[]>([]);
  const recordStartedRef = useRef(false);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [value]);

  useEffect(() => {
    if (!isRecording) { setLevels([]); return; }
    setLevels((prev) => [...prev.slice(-27), waveLevel]);
  }, [waveLevel, isRecording]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDisabled && value.trim()) onSend();
    }
  };

  const canSend = !isDisabled && value.trim().length > 0;

  const beginHold = (e: PointerEvent) => {
    e.preventDefault();
    if (isDisabled || recordStartedRef.current) return;
    recordStartedRef.current = true;
    onRecordStart();
  };

  const endHold = (e: PointerEvent) => {
    e.preventDefault();
    if (!recordStartedRef.current) return;
    recordStartedRef.current = false;
    onRecordStop();
  };

  return (
    <div
      className="px-2 sm:px-3 pt-1.5"
      // Clear the home indicator on gesture-nav phones, with a sensible
      // minimum on devices that report no inset.
      style={{ paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
    >
      <div
        className="flex items-end gap-2 rounded-2xl px-2 py-1.5 transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: `1.5px solid ${isRecording ? accentColor + '60' : 'rgba(255,255,255,0.09)'}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isRecording
            ? `0 0 0 3px ${accentColor}15, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Hold-to-record mic button */}
        {voiceSupported && (
          <button
            onPointerDown={beginHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            disabled={isDisabled && !isRecording}
            title="Hold to record a voice note"
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center select-none touch-none
                       transition-all duration-200 focus:outline-none active:scale-90"
            style={{
              background: isRecording ? accentColor + '30' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isRecording ? accentColor + '60' : 'rgba(255,255,255,0.06)'}`,
              color: isRecording ? accentColor : '#64748b',
              opacity: isDisabled && !isRecording ? 0.4 : 1,
              cursor: isDisabled && !isRecording ? 'not-allowed' : 'pointer',
              boxShadow: isRecording ? `0 0 12px ${accentColor}30` : 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        )}

        {/* Text input / live waveform while recording */}
        {isRecording ? (
          <div className="flex-1 min-w-0 flex items-center gap-2 py-2 px-1" style={{ minHeight: 40 }}>
            <div className="flex items-end gap-[2px] flex-shrink-0" style={{ height: 24, maxWidth: '45%', overflow: 'hidden' }}>
              {levels.map((lvl, i) => (
                <span
                  key={i}
                  className="rounded-full flex-shrink-0"
                  style={{
                    width: 3,
                    height: Math.max(4, lvl * 24),
                    background: accentColor,
                    opacity: 0.4 + (i / levels.length) * 0.6,
                    transition: 'height 0.06s linear',
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium animate-pulse truncate" style={{ color: accentColor }}>
              Recording... release to send
            </span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={isDisabled}
            rows={1}
            className="flex-1 bg-transparent resize-none text-[14px] text-slate-100 placeholder-slate-600
                       focus:outline-none leading-relaxed py-2 px-1"
            style={{ maxHeight: '120px', minHeight: '40px', opacity: isDisabled ? 0.5 : 1 }}
          />
        )}

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!canSend}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                     transition-all duration-200 focus:outline-none active:scale-90"
          style={{
            background: canSend
              ? `linear-gradient(135deg, ${accentColor}dd, ${accentColor}99)`
              : 'rgba(255,255,255,0.04)',
            color: canSend ? 'white' : '#374151',
            cursor: canSend ? 'pointer' : 'not-allowed',
            boxShadow: canSend ? `0 4px 16px ${accentColor}40` : 'none',
            transform: canSend ? 'scale(1)' : 'scale(0.92)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
