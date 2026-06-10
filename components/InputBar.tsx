'use client';

import { useRef, useEffect, KeyboardEvent } from 'react';

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onVoiceToggle: () => void;
  isListening: boolean;
  isDisabled: boolean;
  voiceSupported: boolean;
  accentColor?: string;
}

export default function InputBar({
  value,
  onChange,
  onSend,
  onVoiceToggle,
  isListening,
  isDisabled,
  voiceSupported,
  accentColor = '#8b5cf6',
}: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isDisabled && value.trim()) onSend();
    }
  };

  const canSend = !isDisabled && value.trim().length > 0;

  return (
    <div className="px-3 pb-5 pt-1.5">
      <div
        className="flex items-end gap-2 rounded-2xl px-2 py-1.5 transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: `1.5px solid ${isListening ? accentColor + '60' : 'rgba(255,255,255,0.09)'}`,
          backdropFilter: 'blur(24px)',
          boxShadow: isListening
            ? `0 0 0 3px ${accentColor}15, 0 8px 32px rgba(0,0,0,0.5)`
            : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Mic / stop button */}
        {voiceSupported && (
          <button
            onClick={onVoiceToggle}
            disabled={isDisabled && !isListening}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                       transition-all duration-200 focus:outline-none active:scale-90"
            style={{
              background: isListening ? accentColor + '30' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isListening ? accentColor + '60' : 'rgba(255,255,255,0.06)'}`,
              color: isListening ? accentColor : '#64748b',
              opacity: isDisabled && !isListening ? 0.4 : 1,
              cursor: isDisabled && !isListening ? 'not-allowed' : 'pointer',
              boxShadow: isListening ? `0 0 12px ${accentColor}30` : 'none',
            }}
          >
            {isListening ? (
              /* Stop icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="3"/>
              </svg>
            ) : (
              /* Mic icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </button>
        )}

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '🎤  Listening...' : 'Message...'}
          disabled={isDisabled}
          rows={1}
          className="flex-1 bg-transparent resize-none text-[14px] text-slate-100 placeholder-slate-600
                     focus:outline-none leading-relaxed py-2 px-1"
          style={{ maxHeight: '120px', minHeight: '40px', opacity: isDisabled ? 0.5 : 1 }}
        />

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
