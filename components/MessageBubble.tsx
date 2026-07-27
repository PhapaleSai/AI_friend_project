'use client';

import Image from 'next/image';
import type { Message } from '@/lib/types';
import type { CharacterConfig } from '@/lib/characters';
import { stripMarkdown } from '@/lib/textFormat';

interface MessageBubbleProps {
  message: Message;
  character: CharacterConfig;
  showAvatar?: boolean;
  isSpeaking?: boolean;
  onToggleSpeak?: () => void;
}

// Detect a bare URL on its own line or inline
const URL_REGEX = /(https?:\/\/[^\s\n]+)/g;

function isYouTube(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

function youtubeLabel(url: string): string {
  const match = url.match(/[?&]search_query=([^&]+)/);
  if (match) {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  }
  return 'Watch on YouTube';
}

function YouTubeChip({ url }: { url: string }) {
  const label = youtubeLabel(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-xl no-underline transition-all duration-200 hover:opacity-90 active:scale-95"
      style={{
        background: 'rgba(255,0,0,0.18)',
        border: '1px solid rgba(255,60,60,0.35)',
        display: 'flex',
        width: 'fit-content',
        maxWidth: '100%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* YouTube play icon */}
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: '#ff0000' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
      <div className="overflow-hidden">
        <p className="text-[11px] text-red-300 font-semibold uppercase tracking-wide leading-none mb-0.5">YouTube</p>
        <p className="text-[12px] text-white font-medium leading-tight truncate" style={{ maxWidth: 200 }}>
          {label}
        </p>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-slate-500 flex-shrink-0 ml-auto">
        <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
      </svg>
    </a>
  );
}

function ArticleChip({ title, url, source }: { title: string; url: string; source?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-xl no-underline transition-all duration-200 hover:opacity-90 active:scale-95"
      style={{
        background: 'rgba(59,130,246,0.14)',
        border: '1px solid rgba(96,165,250,0.3)',
        display: 'flex',
        width: 'fit-content',
        maxWidth: '100%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: '#3b82f6' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
          <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7 12h10v2H7v-2zm0-4h10v2H7V8zm0 8h6v2H7v-2z"/>
        </svg>
      </div>
      <div className="overflow-hidden">
        <p className="text-[11px] text-blue-300 font-semibold uppercase tracking-wide leading-none mb-0.5">
          {source || 'Article'}
        </p>
        <p className="text-[12px] text-white font-medium leading-tight truncate" style={{ maxWidth: 220 }}>
          {title}
        </p>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-slate-500 flex-shrink-0 ml-auto">
        <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
      </svg>
    </a>
  );
}

function GenericLinkChip({ url }: { url: string }) {
  let display = url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40);
  if (url.length > 40) display += '…';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs underline break-all"
      style={{ color: '#60a5fa' }}
      onClick={(e) => e.stopPropagation()}>
      {display}
    </a>
  );
}

// Split text into segments: plain text and URLs
function parseSegments(text: string): Array<{ type: 'text' | 'url'; value: string }> {
  const segments: Array<{ type: 'text' | 'url'; value: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', value: text.slice(last, match.index) });
    }
    segments.push({ type: 'url', value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }
  return segments;
}

function renderPlainText(text: string) {
  // Trim blank lines that were just holding a URL
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return null;
  const paras = cleaned.split(/\n\n+/).filter(Boolean);
  return paras.map((para, i) => (
    <p key={i} style={{ margin: i > 0 ? '0.4em 0 0' : 0 }}>
      {para.split('\n').map((line, j) => (
        <span key={j}>{j > 0 && <br />}{line}</span>
      ))}
    </p>
  ));
}

function MessageContent({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text) {
    return isStreaming ? <span className="typing-dots" /> : <span>…</span>;
  }

  const segments = parseSegments(text);

  // Separate inline text from link chips (links that are on their own line)
  const textParts: string[] = [];
  const linkNodes: React.ReactNode[] = [];

  segments.forEach((seg) => {
    if (seg.type === 'url') {
      // Check if the url appears on its own line (preceded/followed by newline or start/end)
      linkNodes.push(
        isYouTube(seg.value)
          ? <YouTubeChip key={seg.value} url={seg.value} />
          : <GenericLinkChip key={seg.value} url={seg.value} />
      );
    } else {
      textParts.push(seg.value);
    }
  });

  const combinedText = stripMarkdown(textParts.join('')).trim();

  return (
    <span className={isStreaming ? 'cursor-blink' : ''}>
      {renderPlainText(combinedText)}
      {linkNodes.length > 0 && (
        <span className="flex flex-col gap-1 mt-1">
          {linkNodes}
        </span>
      )}
    </span>
  );
}

function VoiceNoteRow({ audioUrl, color }: { audioUrl: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="flex items-end gap-[2.5px]" style={{ height: 16 }}>
        {[6, 11, 16, 10, 14, 8, 12].map((h, i) => (
          <span key={i} className="rounded-full" style={{ width: 2.5, height: h, background: 'rgba(255,255,255,0.7)' }} />
        ))}
      </div>
      <audio controls src={audioUrl} style={{ height: 28, maxWidth: 180 }} className="flex-1" />
      <span className="text-[10px] text-white/60 flex-shrink-0" style={{ color }}>🎤</span>
    </div>
  );
}

function ReplayVoiceButton({ isSpeaking, onToggle, color }: { isSpeaking: boolean; onToggle: () => void; color: string }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all duration-200 focus:outline-none"
      style={{
        background: isSpeaking ? `${color}22` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${isSpeaking ? color + '50' : 'rgba(255,255,255,0.08)'}`,
        color: isSpeaking ? color : '#64748b',
      }}
    >
      {isSpeaking ? (
        <span className="flex items-end gap-[2px]" style={{ height: 9 }}>
          {[0, 0.1, 0.2].map((d, i) => (
            <span key={i} className="wave-bar" style={{ animationDelay: `${d}s`, color }} />
          ))}
        </span>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      )}
      {isSpeaking ? 'Playing voice note' : 'Play as voice note'}
    </button>
  );
}

export default function MessageBubble({ message, character, showAvatar = true, isSpeaking = false, onToggleSpeak }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { theme } = character;

  if (isUser) {
    return (
      <div className="msg-user flex justify-end mb-2 px-4">
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-md px-4 py-2.5 text-[14px] leading-[1.6] text-white"
          style={{
            background: `linear-gradient(135deg, ${theme.primary}cc, ${theme.secondary}99)`,
            boxShadow: `0 2px 12px ${theme.primary}30`,
          }}
        >
          {message.isVoiceNote && message.audioUrl && (
            <VoiceNoteRow audioUrl={message.audioUrl} color={theme.secondary} />
          )}
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-ai flex items-end gap-2.5 mb-3 px-4">
      {showAvatar ? (
        <div
          className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-0.5"
          style={{ boxShadow: `0 0 0 1.5px ${theme.primary}50, 0 0 8px ${theme.primary}25` }}
        >
          <Image src={character.avatar} alt={character.name} width={32} height={32}
            className="w-full h-full object-cover"
            style={{ objectPosition: character.avatarPosition }} />
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className="max-w-[78%] flex flex-col gap-0.5">
        {showAvatar && (
          <span className="text-[10px] font-semibold ml-1 mb-0.5" style={{ color: theme.nameColor }}>
            {character.name}
          </span>
        )}
        <div
          className="rounded-2xl rounded-bl-md px-4 py-2.5 text-[14px] leading-[1.65] text-slate-100"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${theme.primary}18`,
            backdropFilter: 'blur(16px)',
          }}
        >
          <MessageContent text={message.content} isStreaming={message.isStreaming} />
          {message.sources && message.sources.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {message.sources.map((s) => (
                <ArticleChip key={s.url} title={s.title} url={s.url} source={s.source} />
              ))}
            </div>
          )}
        </div>
        {!message.isStreaming && message.content && onToggleSpeak && (
          <ReplayVoiceButton isSpeaking={isSpeaking} onToggle={onToggleSpeak} color={theme.primary} />
        )}
      </div>
    </div>
  );
}
