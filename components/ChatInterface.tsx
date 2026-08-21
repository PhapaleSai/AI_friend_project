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
import { SOURCES_DELIMITER, EMAIL_DELIMITER, REPLIES_DELIMITER } from '@/lib/constants';
import { splitIntoBubbles, bubbleDelay } from '@/lib/bubbles';
import VoiceOrb from './VoiceOrb';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import CharacterSelector from './CharacterSelector';
import CharacterSheet from './CharacterSheet';
import CharacterCreator from './CharacterCreator';
import MoodSelector from './MoodSelector';
import ProfilePanel from './ProfilePanel';
import CallOverlay from './CallOverlay';
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

// Hands-free call mode. Turns end on a pause rather than a button, so these
// thresholds decide how it feels: too eager and it cuts you off mid-sentence,
// too patient and every reply lags.
const CALL_SPEAK_LEVEL = 0.13;    // mic amplitude that counts as speech, not room noise
const CALL_SILENCE_MS = 1300;     // quiet time after speech that ends your turn
const CALL_MAX_TURN_MS = 25_000;  // hard cap so one long turn can't run away
const CALL_NO_SPEECH_MS = 12_000; // silence from the start — assume they walked off

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
  const [profile, setProfile] = useState<UserProfile>({ nickname: '', birthday: '', tone: 'default', betterVoice: false });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  // True between the first and last bubble of a multi-bubble reply.
  const [isRevealing, setIsRevealing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recordingHandleRef = useRef<RecordingHandle | null>(null);
  const turnCountRef = useRef<Record<string, number>>({});
  // Read from inside speech/mic callbacks, which close over stale state.
  const callActiveRef = useRef(false);
  // The mic level callback fires ~60x/s; this keeps one turn from ending twice.
  const turnEndingRef = useRef(false);
  // Breaks the cycle between "finish a turn" and "start the next one".
  const nextCallTurnRef = useRef<() => void>(() => {});

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
  const lastMessage = messages[messages.length - 1];
  const quickReplies = lastMessage?.role === 'assistant' && !lastMessage.isStreaming
    ? lastMessage.quickReplies ?? []
    : [];

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
    // Switching characters mid-call would hand the line to someone else.
    callActiveRef.current = false;
    setCallActive(false);
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
    const multiBubble = !!character.multiBubble;
    // A character can opt out of Kokoro when the device's own voices suit it
    // better — Jean wants an Indian accent, which Kokoro simply doesn't have.
    const useKokoroVoice = profile.betterVoice && !character.voiceSettings.preferBrowserVoice;

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
        if (multiBubble) continue; // painted as bubbles once the stream ends
        const displayText = fullText
          .split(SOURCES_DELIMITER)[0].split(EMAIL_DELIMITER)[0].split(REPLIES_DELIMITER)[0];
        setMessagesByChar((prev) => ({
          ...prev,
          [characterId]: prev[characterId].map((m) =>
            m.id === assistantId ? { ...m, content: displayText, isStreaming: true } : m
          ),
        }));
      }

      // Delimiters are appended in stream order: text, sources, email, replies.
      const [beforeReplies, repliesJson] = fullText.split(REPLIES_DELIMITER);
      const [beforeEmail, emailJson] = beforeReplies.split(EMAIL_DELIMITER);
      const [displayText, sourcesJson] = beforeEmail.split(SOURCES_DELIMITER);
      let sources: Message['sources'];
      if (sourcesJson) {
        try { sources = JSON.parse(sourcesJson); } catch { /* ignore malformed sources */ }
      }
      let emailDraft: Message['emailDraft'];
      if (emailJson) {
        try { emailDraft = JSON.parse(emailJson); } catch { /* ignore malformed draft */ }
      }
      let quickReplies: Message['quickReplies'];
      if (repliesJson) {
        try { quickReplies = JSON.parse(repliesJson); } catch { /* ignore malformed replies */ }
      }

      // Real texting arrives as a few short messages, not one block, so for
      // personas that write that way each line becomes its own bubble.
      const segments = multiBubble ? splitIntoBubbles(displayText) : [displayText];
      const bubbles: Message[] = segments.map((content, i) => ({
        id: i === 0 ? assistantId : genId(),
        role: 'assistant' as const,
        content,
        isStreaming: false,
        createdAt: new Date().toISOString(),
        // Source cards, the email draft and the reply chips belong under the
        // last bubble — hanging them off the first would put them mid-reply.
        ...(i === segments.length - 1 ? { sources, emailDraft, quickReplies } : {}),
      }));

      const finalMessages = [...messages, userMsg, ...bubbles];
      const regexFacts = buildMemoryContext(finalMessages);
      const mergedFacts = mergeFacts(memoryFacts, regexFacts);
      setMemoryByChar((prev) => ({ ...prev, [characterId]: mergedFacts }));
      // First bubble lands immediately; the rest follow below.
      setMessagesByChar((prev) => ({ ...prev, [characterId]: [...messages, userMsg, bubbles[0]] }));

      // On a call the reply is always spoken — the mute toggle governs the
      // chat view, and a silent call would just be a dead line. Speech covers
      // the whole reply and starts now, so it runs alongside the bubbles
      // rather than waiting for the last one to land.
      if ((voiceEnabled || callActiveRef.current) && ttsSupported && displayText) {
        // Hand the turn back to the mic once the reply finishes, after a beat
        // so the tail of the sentence isn't recorded back as your answer.
        const resume = () => {
          setOrbState('idle');
          setStatusText('');
          setSpeakingMessageId(null);
          if (callActiveRef.current) setTimeout(() => nextCallTurnRef.current(), 350);
        };
        setOrbState('speaking');
        setStatusText('Speaking...');
        setSpeakingMessageId(assistantId);
        speak(displayText, character.voiceSettings, {
          onEnd: resume,
          onError: resume,
        }, useKokoroVoice);
      } else {
        setOrbState('idle');
        if (callActiveRef.current) setTimeout(() => nextCallTurnRef.current(), 350);
      }

      // Remaining bubbles arrive one at a time, with the typing dots in
      // between, the way a person sending three quick texts looks.
      if (bubbles.length > 1) {
        setIsRevealing(true);
        for (let i = 1; i < bubbles.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, bubbleDelay(bubbles[i].content)));
          setMessagesByChar((prev) => ({
            ...prev,
            [characterId]: [...messages, userMsg, ...bubbles.slice(0, i + 1)],
          }));
        }
        setIsRevealing(false);
      }

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
      // A failed turn has nothing to speak, so the call would sit silent
      // waiting for a reply that never comes — hang up instead.
      if (callActiveRef.current) {
        callActiveRef.current = false;
        setCallActive(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, voiceEnabled, ttsSupported, characterId, memoryFacts, userName, mood, profile.tone, character]);

  /** Hangs up: stops the mic and any speech, and stops the turn loop. */
  const endCall = useCallback((message?: string) => {
    callActiveRef.current = false;
    setCallActive(false);
    recordingHandleRef.current?.cancel();
    recordingHandleRef.current = null;
    turnEndingRef.current = false;
    setIsRecording(false);
    setWaveLevel(0);
    stopSpeaking();
    setSpeakingMessageId(null);
    setOrbState('idle');
    setStatusText(message ?? '');
    if (message) setTimeout(() => setStatusText(''), 2500);
  }, []);

  /**
   * Ends the current listening turn and moves it along: transcribe, send, and
   * let the reply's speech callback start the next turn. Anything that isn't
   * usable speech loops back to listening rather than dropping the call.
   */
  const finishCallTurn = useCallback(async (heardSpeech: boolean) => {
    if (turnEndingRef.current) return;
    turnEndingRef.current = true;

    const handle = recordingHandleRef.current;
    recordingHandleRef.current = null;
    setIsRecording(false);
    setWaveLevel(0);
    if (!handle) { turnEndingRef.current = false; return; }

    if (!heardSpeech) {
      handle.cancel();
      turnEndingRef.current = false;
      endCall('Call ended — no one there');
      return;
    }

    setOrbState('thinking');
    setStatusText('Transcribing...');
    const blob = await handle.stop();
    turnEndingRef.current = false;
    if (!callActiveRef.current) return; // hung up while we were finishing

    if (blob.size < 500) { nextCallTurnRef.current(); return; }

    const transcript = await transcribeAudio(blob);
    if (!callActiveRef.current) return;
    if (!transcript.trim()) { nextCallTurnRef.current(); return; }

    sendMessage(transcript, { isVoiceNote: true, audioUrl: URL.createObjectURL(blob) });
  }, [endCall, sendMessage]);

  /**
   * Opens the mic for one turn. There's no stop button: the amplitude stream
   * that drives the waveform doubles as voice detection, so the turn ends when
   * you stop talking.
   */
  const startCallTurn = useCallback(async () => {
    if (!callActiveRef.current || recordingHandleRef.current) return;

    const startedAt = Date.now();
    let heardSpeech = false;
    let lastSpeechAt = 0;

    try {
      const handle = await startRecording((lvl) => {
        setWaveLevel(lvl);
        const now = Date.now();
        if (lvl > CALL_SPEAK_LEVEL) { heardSpeech = true; lastSpeechAt = now; }

        const turnOver = heardSpeech
          ? now - lastSpeechAt > CALL_SILENCE_MS || now - startedAt > CALL_MAX_TURN_MS
          : now - startedAt > CALL_NO_SPEECH_MS;
        if (turnOver) finishCallTurn(heardSpeech);
      });
      // Hung up during the getUserMedia await — don't leave the mic open.
      if (!callActiveRef.current) { handle.cancel(); return; }
      recordingHandleRef.current = handle;
      setIsRecording(true);
      setOrbState('listening');
      setStatusText('Listening...');
    } catch {
      endCall('Mic permission denied');
    }
  }, [finishCallTurn, endCall]);

  // startCallTurn is referenced by callbacks defined above it; the ref keeps
  // them pointed at the current one.
  useEffect(() => { nextCallTurnRef.current = startCallTurn; }, [startCallTurn]);

  const startCall = useCallback(() => {
    if (!voiceSupported || !ttsSupported || isLoading) return;
    stopSpeaking();
    setSpeakingMessageId(null);
    setShowMenu(false);
    setCallSeconds(0);
    callActiveRef.current = true;
    setCallActive(true);
    nextCallTurnRef.current();
  }, [voiceSupported, ttsSupported, isLoading]);

  // Call timer
  useEffect(() => {
    if (!callActive) return;
    const id = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [callActive]);

  // Leaving the screen with the mic live would keep recording in the
  // background, so treat unmount as hanging up.
  useEffect(() => () => {
    callActiveRef.current = false;
    recordingHandleRef.current?.cancel();
    recordingHandleRef.current = null;
    stopSpeaking();
  }, []);

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
    }, profile.betterVoice && !character.voiceSettings.preferBrowserVoice);
  }, [character, speakingMessageId, profile.betterVoice]);

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
      className="app-screen flex flex-col w-full overflow-hidden"
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
      {callActive && (
        <CallOverlay
          character={character}
          state={orbState}
          level={waveLevel}
          elapsedLabel={`${Math.floor(callSeconds / 60)}:${String(callSeconds % 60).padStart(2, '0')}`}
          onEnd={() => endCall()}
        />
      )}
      {showSheet && (
        <CharacterSheet
          characters={Object.values(allCharacters)}
          selected={characterId}
          onChange={handleCharacterChange}
          onCreateNew={() => setShowCreator(true)}
          onDelete={handleDeleteCharacter}
          onClose={() => setShowSheet(false)}
        />
      )}

      {/* ─── Header ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 flex-shrink-0 transition-all duration-500"
        style={{
          background: 'rgba(7,7,15,0.85)',
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${character.theme.primary}18`,
          boxShadow: `0 1px 0 ${character.theme.primary}10`,
          // Status bar overlays the header in standalone mode (black-translucent),
          // so add the inset plus breathing room rather than sitting flush under it.
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center text-slate-500
                         hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </button>
          )}
          {/* Phones: just the active character, tap to switch. Showing all of
              them inline leaves each card a sliver wide on a narrow screen. */}
          <button
            onClick={() => setShowSheet(true)}
            className="lg:hidden flex items-center gap-2.5 min-w-0 px-2 py-1.5 rounded-2xl transition-all duration-200 active:scale-95 focus:outline-none"
            style={{ background: character.theme.tabActive, border: `1px solid ${character.theme.primary}45` }}
          >
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
              style={{ boxShadow: `0 0 0 2px ${character.theme.primary}, 0 0 10px ${character.theme.primary}55` }}
            >
              <Image
                src={character.avatar}
                alt={character.name}
                width={36}
                height={36}
                className="w-full h-full object-cover"
                style={{ objectPosition: character.avatarPosition }}
                unoptimized={character.isCustom}
              />
            </div>
            <span
              className="text-[1.0000rem] font-semibold leading-none truncate"
              style={{ color: character.theme.primary }}
            >
              {character.name}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
              className="flex-shrink-0" style={{ color: character.theme.primary }}>
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>

          {/* Laptops: the full inline selector, unchanged */}
          <div className="hidden lg:block min-w-0">
            <CharacterSelector
              selected={characterId}
              onChange={handleCharacterChange}
              characters={Object.values(allCharacters)}
              onCreateNew={() => setShowCreator(true)}
              onDelete={handleDeleteCharacter}
            />
          </div>
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

          {/* Call button */}
          {voiceSupported && ttsSupported && (
            <button
              onClick={startCall}
              disabled={isLoading}
              className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none"
              style={{
                background: `${character.theme.primary}18`,
                border: `1px solid ${character.theme.primary}35`,
                color: character.theme.primary,
                opacity: isLoading ? 0.4 : 1,
              }}
              title={`Call ${character.name}`}
            >
              <svg className="w-4 h-4 lg:w-[0.8125rem] lg:h-[0.8125rem]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
            </button>
          )}

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center text-slate-500
                       hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none"
            title="Your profile"
          >
            <svg className="w-[1.0625rem] h-[1.0625rem] lg:w-[0.8750rem] lg:h-[0.8750rem]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9z"/>
            </svg>
          </button>

          {/* Voice toggle */}
          {ttsSupported && (
            <button
              onClick={() => { setVoiceEnabled((v) => !v); if (voiceEnabled) stopSpeaking(); }}
              className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none"
              style={{
                background: voiceEnabled ? `${character.theme.primary}18` : 'transparent',
                border: `1px solid ${voiceEnabled ? character.theme.primary + '35' : 'rgba(255,255,255,0.07)'}`,
                color: voiceEnabled ? character.theme.primary : '#475569',
              }}
              title={voiceEnabled ? 'Mute' : 'Unmute'}
            >
              {voiceEnabled ? (
                <svg className="w-4 h-4 lg:w-[0.8125rem] lg:h-[0.8125rem]" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 lg:w-[0.8125rem] lg:h-[0.8125rem]" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
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
              className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center transition-all duration-200 focus:outline-none"
              style={{
                background: showSearch ? `${character.theme.primary}18` : 'transparent',
                color: showSearch ? character.theme.primary : '#64748b',
              }}
              title="Search this chat"
            >
              <svg className="w-[1.0625rem] h-[1.0625rem] lg:w-[0.8750rem] lg:h-[0.8750rem]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>
          )}

          {/* Overflow menu */}
          {(hasMessages || character.isCustom) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-10 h-10 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center text-slate-500
                           hover:text-white hover:bg-white/8 transition-all duration-200 focus:outline-none"
                title="More"
              >
                <svg className="w-[1.0625rem] h-[1.0625rem] lg:w-[0.8750rem] lg:h-[0.8750rem]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div
                    className="absolute right-0 top-10 z-50 min-w-[10.6250rem] rounded-xl py-1 overflow-hidden"
                    style={{
                      background: 'rgba(22,22,34,0.98)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                    }}
                  >
                    {character.isCustom && (
                      <button
                        onClick={() => { setShowMenu(false); handleShareCharacter(); }}
                        className="w-full text-left px-3.5 py-3 lg:py-2.5 text-[0.8750rem] lg:text-xs text-slate-300 hover:bg-white/8 transition-colors focus:outline-none"
                      >
                        Share this character
                      </button>
                    )}
                    {hasMessages && (
                      <button
                        onClick={() => { setShowMenu(false); handleExport(); }}
                        className="w-full text-left px-3.5 py-3 lg:py-2.5 text-[0.8750rem] lg:text-xs text-slate-300 hover:bg-white/8 transition-colors focus:outline-none"
                      >
                        Export chat (.md)
                      </button>
                    )}
                    {hasMessages && (
                      <button
                        onClick={() => { setShowMenu(false); handleClear(); }}
                        className="w-full text-left px-3.5 py-3 lg:py-2.5 text-[0.8750rem] lg:text-xs text-red-400 hover:bg-white/8 transition-colors focus:outline-none"
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
            className="flex-1 min-w-0 bg-transparent text-[1.0000rem] lg:text-sm text-slate-100 placeholder-slate-600 focus:outline-none py-1"
          />
          <span className="text-[0.6875rem] text-slate-600 flex-shrink-0">
            {trimmedQuery ? `${visibleMessages.length} found` : ''}
          </span>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-colors focus:outline-none flex-shrink-0"
          >
            <svg className="w-[1.0625rem] h-[1.0625rem] lg:w-[0.8750rem] lg:h-[0.8750rem]" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
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
              <p className="text-slate-400 text-[0.9375rem] lg:text-sm max-w-[300px] mx-auto leading-relaxed">{character.subtitle}</p>
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
                  className="px-4 py-2.5 lg:py-2 rounded-full text-[0.9062rem] lg:text-sm text-slate-300 hover:text-white
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
              <p className="text-slate-700 text-[0.8125rem] lg:text-xs">Hold the photo to record · or type below</p>
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
              {((isLoading && messages.length > 0 && !messages[messages.length - 1]?.content) || isRevealing) && (
                <TypingIndicator color={character.theme.primary} />
              )}

              {/* Quick replies — only under the newest reply, and never while
                  searching, where the "last message" isn't the thread's last. */}
              {!trimmedQuery && !isLoading && !isRevealing && !callActive && quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 pt-1 pb-2 fade-in">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => sendMessage(reply)}
                      className="px-3 py-1.5 rounded-full text-[0.8125rem] transition-all duration-200
                                 active:scale-95 focus:outline-none"
                      style={{
                        background: `${character.theme.primary}12`,
                        border: `1px solid ${character.theme.primary}30`,
                        color: character.theme.primary,
                      }}
                    >
                      {reply}
                    </button>
                  ))}
                </div>
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
