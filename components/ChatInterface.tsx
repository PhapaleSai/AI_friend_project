'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Message, OrbState, CharacterId } from '@/lib/types';
import type { CharacterConfig } from '@/lib/characters';
import { getAllCharacters, deleteCustomCharacter, exportCharacterCode } from '@/lib/customCharacters';
import {
  loadConversation,
  saveConversation,
  clearConversation,
  buildMemoryContext,
  extractFactsWithLLM,
  mergeFacts,
  joinFacts,
} from '@/lib/memory';
import { loadProfile, saveProfile, type UserProfile } from '@/lib/profile';
import { SOURCES_DELIMITER, EMAIL_DELIMITER } from '@/lib/constants';
import VoiceOrb from './VoiceOrb';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import CharacterSelector from './CharacterSelector';
import CharacterCreator from './CharacterCreator';
import MoodSelector from './MoodSelector';
import ProfilePanel from './ProfilePanel';
import {
  speak,
  stopSpeaking,
  startRecording,
  transcribeAudio,
  isMicSupported,
  isSpeechSynthesisSupported,
  type RecordingHandle,
} from '@/lib/speech';

const MOOD_SESSION_KEY = 'friend-ai-mood-session';
const FACT_EXTRACTION_EVERY = 6; // user turns between background LLM fact-extraction passes

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

interface ChatInterfaceProps {
  initialCharacter?: CharacterId;
  onBack?: () => void;
  userName?: string;
}

function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-2.5 px-4 mb-3">
      <div className="w-8 h-8 rounded-full flex-shrink-0" />
      <div
        className="px-4 py-3 rounded-2xl rounded-bl-md"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${color}18`,
        }}
      >
        <div className="typing-indicator">
          <span style={{ background: color + 'aa' }} />
          <span style={{ background: color + 'aa' }} />
          <span style={{ background: color + 'aa' }} />
        </div>
      </div>
    </div>
  );
}

function exportToMarkdown(character: CharacterConfig, userName: string, messages: Message[]): string {
  const lines = [`# Chat with ${character.name}`, ''];
  for (const m of messages) {
    const who = m.role === 'user' ? (userName || 'You') : character.name;
    lines.push(`**${who}:** ${m.content}`, '');
  }
  return lines.join('\n');
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ChatInterface({ initialCharacter = 'naina', onBack, userName = '' }: ChatInterfaceProps) {
  const [allCharacters, setAllCharacters] = useState<Record<string, CharacterConfig>>({});
  const [characterId, setCharacterId] = useState<CharacterId>(initialCharacter);
  const [messagesByChar, setMessagesByChar] = useState<Record<string, Message[]>>({});
  const [memoryByChar, setMemoryByChar] = useState<Record<string, string[]>>({});
  const [inputText, setInputText] = useState('');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [waveLevel, setWaveLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [statusText, setStatusText] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [showMood, setShowMood] = useState(false);
  const [mood, setMood] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ nickname: '', birthday: '', tone: 'default' });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingHandleRef = useRef<RecordingHandle | null>(null);
  const turnCountRef = useRef<Record<string, number>>({});

  const character = allCharacters[characterId];
  const messages = messagesByChar[characterId] ?? [];
  const memoryFacts = memoryByChar[characterId] ?? [];
  const hasMessages = messages.length > 0;
  const trimmedQuery = searchQuery.trim();
  const visibleMessages = trimmedQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : messages;
  const voiceSupported = typeof window !== 'undefined' && isMicSupported();
  const ttsSupported = typeof window !== 'undefined' && isSpeechSynthesisSupported();

  useEffect(() => {
    const merged = getAllCharacters();
    setAllCharacters(merged);

    const nextMessages: Record<string, Message[]> = {};
    const nextMemory: Record<string, string[]> = {};
    for (const id of Object.keys(merged)) {
      const data = loadConversation(id);
      nextMessages[id] = data.messages;
      nextMemory[id] = data.memoryFacts;
    }
    setMessagesByChar(nextMessages);
    setMemoryByChar(nextMemory);
    setProfile(loadProfile());

    if (!sessionStorage.getItem(MOOD_SESSION_KEY)) setShowMood(true);

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Jump back to the top when filtering, so results read from the beginning
  // instead of leaving the view pinned to the bottom of the thread.
  useEffect(() => {
    if (trimmedQuery && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [trimmedQuery]);

  const handleCharacterChange = useCallback((id: CharacterId) => {
    stopSpeaking();
    recordingHandleRef.current?.cancel();
    recordingHandleRef.current = null;
    setIsRecording(false);
    setOrbState('idle');
    setStatusText('');
    setSpeakingMessageId(null);
    setCharacterId(id);
    setInputText('');
    setShowSearch(false);
    setSearchQuery('');
  }, []);

  const sendMessage = useCallback(async (text: string, voiceMeta?: { isVoiceNote?: boolean; audioUrl?: string }) => {
    if (!text.trim() || isLoading || !character) return;
    stopSpeaking();
    setSpeakingMessageId(null);

    const userMsg: Message = {
      id: genId(), role: 'user', content: text.trim(),
      isVoiceNote: voiceMeta?.isVoiceNote, audioUrl: voiceMeta?.audioUrl,
      createdAt: new Date().toISOString(),
    };
    const assistantId = genId();
    const assistantMsg: Message = {
      id: assistantId, role: 'assistant', content: '', isStreaming: true,
      createdAt: new Date().toISOString(),
    };
    const updatedMessages = [...messages, userMsg, assistantMsg];

    setMessagesByChar((prev) => ({ ...prev, [characterId]: updatedMessages }));
    setInputText('');
    setIsLoading(true);
    setOrbState('thinking');
    setStatusText('Thinking...');

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          characterId,
          memoryContext: joinFacts(memoryFacts),
          userName,
          mood: mood || undefined,
          tone: profile.tone !== 'default' ? profile.tone : undefined,
          customSystemPrompt: character.isCustom ? character.systemPrompt : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        let errMsg = `API error ${res.status}`;
        try {
          const errData = await res.json() as { error?: string };
          if (errData.error) errMsg = errData.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      setStatusText('');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const displayText = fullText.split(SOURCES_DELIMITER)[0].split(EMAIL_DELIMITER)[0];
        setMessagesByChar((prev) => ({
          ...prev,
          [characterId]: prev[characterId].map((m) =>
            m.id === assistantId ? { ...m, content: displayText, isStreaming: true } : m
          ),
        }));
      }

      const [beforeEmail, emailJson] = fullText.split(EMAIL_DELIMITER);
      const [displayText, sourcesJson] = beforeEmail.split(SOURCES_DELIMITER);
      let sources: Message['sources'];
      if (sourcesJson) {
        try { sources = JSON.parse(sourcesJson); } catch { /* ignore malformed sources */ }
      }
      let emailDraft: Message['emailDraft'];
      if (emailJson) {
        try { emailDraft = JSON.parse(emailJson); } catch { /* ignore malformed draft */ }
      }

      const finalMessages = updatedMessages.map((m) =>
        m.id === assistantId ? { ...m, content: displayText, isStreaming: false, sources, emailDraft } : m
      );
      const regexFacts = buildMemoryContext(finalMessages);
      const mergedFacts = mergeFacts(memoryFacts, regexFacts);
      setMessagesByChar((prev) => ({ ...prev, [characterId]: finalMessages }));
      setMemoryByChar((prev) => ({ ...prev, [characterId]: mergedFacts }));
      saveConversation(characterId, finalMessages, mergedFacts);

      // Background AI fact extraction every few turns — non-blocking.
      const turns = (turnCountRef.current[characterId] ?? 0) + 1;
      turnCountRef.current[characterId] = turns;
      if (turns % FACT_EXTRACTION_EVERY === 0) {
        extractFactsWithLLM(finalMessages).then((llmFacts) => {
          if (llmFacts.length === 0) return;
          setMemoryByChar((prev) => {
            const merged = mergeFacts(prev[characterId] ?? [], llmFacts);
            saveConversation(characterId, finalMessages, merged);
            return { ...prev, [characterId]: merged };
          });
        });
      }

      if (voiceEnabled && ttsSupported && displayText) {
        setOrbState('speaking');
        setStatusText('Speaking...');
        setSpeakingMessageId(assistantId);
        speak(displayText, character.voiceSettings, {
          onEnd: () => { setOrbState('idle'); setStatusText(''); setSpeakingMessageId(null); },
          onError: () => { setOrbState('idle'); setStatusText(''); setSpeakingMessageId(null); },
        });
      } else {
        setOrbState('idle');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const errorMsg = characterId === 'bunny'
        ? `Bhai, kuch gadbad ho gayi — ${raw.slice(0, 80)}`
        : `Something went wrong — ${raw.slice(0, 80)}`;
      setMessagesByChar((prev) => ({
        ...prev,
        [characterId]: prev[characterId].map((m) =>
          m.id === assistantId ? { ...m, content: errorMsg, isStreaming: false } : m
        ),
      }));
      setOrbState('idle');
      setStatusText('');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, voiceEnabled, ttsSupported, characterId, memoryFacts, userName, mood, profile.tone, character]);

  const handleRecordStart = useCallback(async () => {
    if (isLoading || recordingHandleRef.current) return;
    stopSpeaking();
    setSpeakingMessageId(null);
    try {
      const handle = await startRecording((lvl) => setWaveLevel(lvl));
      recordingHandleRef.current = handle;
      setIsRecording(true);
      setOrbState('listening');
      setStatusText('Recording...');
    } catch {
      setStatusText('Mic permission denied');
      setTimeout(() => setStatusText(''), 2500);
    }
  }, [isLoading]);

  const handleRecordStop = useCallback(async () => {
    const handle = recordingHandleRef.current;
    recordingHandleRef.current = null;
    if (!handle) return;
    setIsRecording(false);
    setWaveLevel(0);

    setOrbState('thinking');
    setStatusText('Transcribing...');
    const blob = await handle.stop();

    if (blob.size < 500) {
      // Too short to be real speech — likely an accidental tap.
      setOrbState('idle');
      setStatusText('');
      return;
    }

    const transcript = await transcribeAudio(blob);
    setStatusText('');
    if (!transcript.trim()) {
      setOrbState('idle');
      setStatusText("Couldn't catch that — try again");
      setTimeout(() => setStatusText(''), 2500);
      return;
    }
    const audioUrl = URL.createObjectURL(blob);
    sendMessage(transcript, { isVoiceNote: true, audioUrl });
  }, [sendMessage]);

  const handleOrbPointerDown = useCallback(() => {
    if (isLoading) return;
    if (orbState === 'speaking') {
      stopSpeaking();
      setSpeakingMessageId(null);
      setOrbState('idle');
      setStatusText('');
      return;
    }
    handleRecordStart();
  }, [isLoading, orbState, handleRecordStart]);

  const handleOrbPointerUp = useCallback(() => {
    if (recordingHandleRef.current) handleRecordStop();
  }, [handleRecordStop]);

  const handleToggleSpeak = useCallback((message: Message) => {
    if (!character) return;
    if (speakingMessageId === message.id) {
      stopSpeaking();
      setSpeakingMessageId(null);
      return;
    }
    stopSpeaking();
    setSpeakingMessageId(message.id);
    speak(message.content, character.voiceSettings, {
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null),
    });
  }, [character, speakingMessageId]);

  const handleClear = useCallback(() => {
    stopSpeaking();
    recordingHandleRef.current?.cancel();
    clearConversation(characterId);
    setMessagesByChar((prev) => ({ ...prev, [characterId]: [] }));
    setMemoryByChar((prev) => ({ ...prev, [characterId]: [] }));
    setOrbState('idle');
    setStatusText('');
  }, [characterId]);

  const handleExport = useCallback(() => {
    if (!character) return;
    const md = exportToMarkdown(character, userName, messages);
    downloadText(`${character.name.toLowerCase()}-chat.md`, md);
  }, [character, userName, messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 240);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const handleShareCharacter = useCallback(async () => {
    if (!character?.isCustom) return;
    const code = await exportCharacterCode(character);
    try {
      await navigator.clipboard.writeText(code);
      setStatusText('Share code copied!');
    } catch {
      // Clipboard blocked (non-HTTPS or denied) — fall back to a prompt the
      // user can copy from manually.
      window.prompt('Copy this share code:', code);
      setStatusText('');
      return;
    }
    setTimeout(() => setStatusText((prev) => (prev === 'Share code copied!' ? '' : prev)), 2500);
  }, [character]);

  const handleMoodSelect = useCallback((value: string) => {
    setMood(value);
    sessionStorage.setItem(MOOD_SESSION_KEY, value);
    setShowMood(false);
  }, []);

  const handleMoodSkip = useCallback(() => {
    sessionStorage.setItem(MOOD_SESSION_KEY, 'skipped');
    setShowMood(false);
  }, []);

  const handleDeleteFact = useCallback((index: number) => {
    setMemoryByChar((prev) => {
      const next = (prev[characterId] ?? []).filter((_, i) => i !== index);
      saveConversation(characterId, messagesByChar[characterId] ?? [], next);
      return { ...prev, [characterId]: next };
    });
  }, [characterId, messagesByChar]);

  const handleCharacterCreated = useCallback((config: CharacterConfig) => {
    setAllCharacters(getAllCharacters());
    setShowCreator(false);
    handleCharacterChange(config.id);
  }, [handleCharacterChange]);

  const handleDeleteCharacter = useCallback((id: string) => {
    deleteCustomCharacter(id);
    clearConversation(id);
    const next = getAllCharacters();
    setAllCharacters(next);
    if (id === characterId) handleCharacterChange('naina');
  }, [characterId, handleCharacterChange]);

  if (!hydrated || !character) return null;

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 15% 0%, ${character.theme.primary}0d 0%, transparent 55%),
                     radial-gradient(ellipse at 85% 100%, ${character.theme.secondary}08 0%, transparent 55%),
                     #07070f`,
      }}
    >
      {showMood && <MoodSelector onSelect={handleMoodSelect} onSkip={handleMoodSkip} />}
      {showProfile && (
        <ProfilePanel
          profile={profile}
          facts={memoryFacts}
          characterName={character.name}
          accentColor={character.theme.primary}
          onSave={(p) => { setProfile(p); saveProfile(p); }}
          onDeleteFact={handleDeleteFact}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showCreator && (
        <CharacterCreator onClose={() => setShowCreator(false)} onCreated={handleCharacterCreated} />
      )}

      {/* ─── Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 flex-shrink-0 transition-all duration-500"
        style={{
          background: 'rgba(7,7,15,0.85)',
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${character.theme.primary}18`,
          boxShadow: `0 1px 0 ${character.theme.primary}10`,
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500
                         hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </button>
          )}
          <CharacterSelector
            selected={characterId}
            onChange={handleCharacterChange}
            characters={Object.values(allCharacters)}
            onCreateNew={() => setShowCreator(true)}
            onDelete={handleDeleteCharacter}
          />
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Live status pill */}
          {statusText ? (
            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-300"
              style={{
                background: `${character.theme.primary}15`,
                border: `1px solid ${character.theme.primary}30`,
                color: character.theme.primary,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: character.theme.primary }} />
              {statusText}
            </div>
          ) : null}

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500
                       hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none"
            title="Your profile"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9z"/>
            </svg>
          </button>

          {/* Voice toggle */}
          {ttsSupported && (
            <button
              onClick={() => { setVoiceEnabled((v) => !v); if (voiceEnabled) stopSpeaking(); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none"
              style={{
                background: voiceEnabled ? `${character.theme.primary}18` : 'transparent',
                border: `1px solid ${voiceEnabled ? character.theme.primary + '35' : 'rgba(255,255,255,0.07)'}`,
                color: voiceEnabled ? character.theme.primary : '#475569',
              }}
              title={voiceEnabled ? 'Mute' : 'Unmute'}
            >
              {voiceEnabled ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              )}
            </button>
          )}

          {/* Search toggle */}
          {hasMessages && (
            <button
              onClick={() => {
                setShowSearch((v) => {
                  if (v) setSearchQuery('');
                  return !v;
                });
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none"
              style={{
                background: showSearch ? `${character.theme.primary}18` : 'transparent',
                color: showSearch ? character.theme.primary : '#64748b',
              }}
              title="Search this chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          )}

          {/* Overflow menu */}
          {(hasMessages || character.isCustom) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500
                           hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none"
                title="More"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div
                    className="absolute right-0 top-10 z-50 min-w-[170px] rounded-xl py-1 overflow-hidden"
                    style={{
                      background: 'rgba(22,22,34,0.98)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                    }}
                  >
                    {character.isCustom && (
                      <button
                        onClick={() => { setShowMenu(false); handleShareCharacter(); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-slate-300 hover:bg-white/8 transition-colors focus:outline-none"
                      >
                        Share this character
                      </button>
                    )}
                    {hasMessages && (
                      <button
                        onClick={() => { setShowMenu(false); handleExport(); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-slate-300 hover:bg-white/8 transition-colors focus:outline-none"
                      >
                        Export chat (.md)
                      </button>
                    )}
                    {hasMessages && (
                      <button
                        onClick={() => { setShowMenu(false); handleClear(); }}
                        className="w-full text-left px-3.5 py-2.5 text-xs text-red-400 hover:bg-white/8 transition-colors focus:outline-none"
                      >
                        Clear chat
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ─── Search bar ──────────────────────────────────────────── */}
      {showSearch && hasMessages && (
        <div
          className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
          style={{ background: 'rgba(7,7,15,0.7)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search this conversation..."
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-100 placeholder-slate-600 focus:outline-none py-1"
          />
          <span className="text-[11px] text-slate-600 flex-shrink-0">
            {trimmedQuery ? `${visibleMessages.length} found` : ''}
          </span>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors focus:outline-none flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {!hasMessages ? (
          /* ── Empty / welcome state ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-4">
            {/* Portrait with live ring */}
            <div className="relative flex flex-col items-center">
              <div
                className="absolute rounded-full opacity-20"
                style={{
                  width: 220, height: 220,
                  background: `radial-gradient(circle, ${character.theme.primary}, ${character.theme.secondary})`,
                  filter: 'blur(50px)',
                  animation: 'pulse-slow 5s ease-in-out infinite',
                }}
              />
              <div
                className="relative w-32 h-32 rounded-full overflow-hidden cursor-pointer select-none touch-none
                           transition-transform duration-300 hover:scale-105 active:scale-95"
                onPointerDown={handleOrbPointerDown}
                onPointerUp={handleOrbPointerUp}
                onPointerLeave={handleOrbPointerUp}
                onPointerCancel={handleOrbPointerUp}
                style={{
                  boxShadow: orbState !== 'idle'
                    ? `0 0 0 3px ${character.theme.primary}, 0 0 40px ${character.theme.primary}70`
                    : `0 0 0 2px ${character.theme.primary}55, 0 8px 32px ${character.theme.primary}30`,
                  transition: 'box-shadow 0.4s ease',
                }}
              >
                <Image src={character.avatar} alt={character.name} width={128} height={128}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: character.avatarPosition }}
                  unoptimized={character.isCustom}
                  priority />
                {orbState !== 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${character.theme.primary}18` }}>
                    <VoiceOrb state={orbState} theme={character.theme} size="sm" />
                  </div>
                )}
              </div>

              {/* State badge */}
              <div
                className="mt-3 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-300"
                style={{
                  background: `${character.theme.primary}15`,
                  border: `1px solid ${character.theme.primary}30`,
                  color: character.theme.primary,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: character.theme.primary }} />
                {orbState === 'listening' ? 'Recording...'
                  : orbState === 'thinking' ? 'Thinking...'
                  : orbState === 'speaking' ? 'Speaking...'
                  : 'Online · Ready'}
              </div>
            </div>

            {/* Name & intro */}
            <div className="text-center">
              <h2
                className="text-3xl font-black mb-1.5 tracking-tight"
                style={{
                  background: `linear-gradient(135deg, ${character.theme.primary}, ${character.theme.secondary})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}
              >
                Hey, I&apos;m {character.name} {character.emoji}
              </h2>
              <p className="text-slate-400 text-sm max-w-[280px] mx-auto leading-relaxed">{character.subtitle}</p>
              {memoryFacts.length > 0 && (
                <p className="text-slate-600 text-xs mt-2 flex items-center justify-center gap-1">
                  <span>💭</span> Remembers your past conversations
                </p>
              )}
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {character.suggestions.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-full text-sm text-slate-300 hover:text-white
                             transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
                  style={{
                    background: `${character.theme.primary}0f`,
                    border: `1px solid ${character.theme.primary}22`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {voiceSupported && (
              <p className="text-slate-700 text-xs">Hold the photo to record · or type below</p>
            )}
          </div>
        ) : (
          /* ── Chat view ── */
          <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto pt-3 pb-2"
              style={{ scrollBehavior: 'smooth' }}
            >
              {trimmedQuery && visibleMessages.length === 0 && (
                <p className="text-center text-slate-600 text-xs mt-8 px-6">
                  No messages match &ldquo;{trimmedQuery}&rdquo;
                </p>
              )}
              {visibleMessages.map((msg, i) => {
                const prevMsg = visibleMessages[i - 1];
                // While searching, every result shows its avatar since
                // neighbours aren't necessarily consecutive in the real thread.
                const showAvatar = msg.role === 'assistant' &&
                  (!!trimmedQuery || !prevMsg || prevMsg.role === 'user');
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    character={character}
                    showAvatar={showAvatar}
                    highlight={trimmedQuery}
                    isSpeaking={speakingMessageId === msg.id}
                    onToggleSpeak={msg.role === 'assistant' && ttsSupported ? () => handleToggleSpeak(msg) : undefined}
                  />
                );
              })}
              {/* Typing indicator while loading before stream starts */}
              {isLoading && messages.length > 0 && !messages[messages.length - 1]?.content && (
                <TypingIndicator color={character.theme.primary} />
              )}
            </div>

            {/* Jump to latest */}
            {showScrollDown && !trimmedQuery && (
              <button
                onClick={scrollToBottom}
                className="absolute right-4 bottom-4 z-10 w-9 h-9 rounded-full flex items-center justify-center
                           transition-all duration-200 active:scale-90 focus:outline-none bounce-in"
                style={{
                  background: 'rgba(22,22,34,0.92)',
                  border: `1px solid ${character.theme.primary}45`,
                  color: character.theme.primary,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(12px)',
                }}
                title="Jump to latest"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                </svg>
              </button>
            )}

            {/* Orb floating pill during active states */}
            {(orbState !== 'idle') && (
              <div className="flex justify-center pb-2 flex-shrink-0">
                <div
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full transition-all duration-300"
                  style={{
                    background: `${character.theme.primary}12`,
                    border: `1px solid ${character.theme.primary}25`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <VoiceOrb
                    state={orbState}
                    theme={character.theme}
                    size="sm"
                    onPointerDown={orbState !== 'listening' ? handleOrbPointerDown : undefined}
                    onPointerUp={handleOrbPointerUp}
                    onPointerLeave={handleOrbPointerUp}
                    onPointerCancel={handleOrbPointerUp}
                  />
                  {statusText && (
                    <span className="text-xs font-medium" style={{ color: character.theme.primary }}>
                      {statusText}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Input ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        <InputBar
          value={inputText}
          onChange={setInputText}
          onSend={() => { if (inputText.trim()) sendMessage(inputText); }}
          onRecordStart={handleRecordStart}
          onRecordStop={handleRecordStop}
          isRecording={isRecording}
          waveLevel={waveLevel}
          isDisabled={isLoading}
          voiceSupported={voiceSupported}
          accentColor={character.theme.primary}
        />
      </div>
    </div>
  );
}
