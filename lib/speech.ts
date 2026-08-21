'use client';

import type { VoiceSettings } from './characters';
import { stripMarkdown } from './textFormat';
import { speakWithKokoro, stopKokoro } from './kokoro';

type SpeechCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (e: string) => void;
};

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function stripEmojisAndClean(text: string): string {
  return stripMarkdown(text)
    // Remove URLs entirely (don't read them aloud)
    .replace(/https?:\/\/[^\s\n]+/g, '')
    // Remove all emoji ranges
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu,   '')
    .replace(/[\u{2300}-\u{23FF}]/gu,   '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Remove variation selectors and ZWJ sequences
    .replace(/[︀-️‍]/g,  '')
    // Collapse multiple spaces/newlines left behind
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isMicSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

// Voice-name fragments that identify a speaker's gender. 'rishi' belongs on
// the male list — it's Apple's male Indian English voice, and having it here
// pushed female characters onto it on iOS and macOS.
const FEMALE_SIGNALS = ['female', 'woman', 'girl', 'samantha', 'zira', 'victoria', 'karen', 'susan', 'fiona', 'moira', 'tessa', 'veena', 'allison', 'ava', 'kate', 'serena', 'heera', 'neerja', 'aditi', 'priya', 'raveena'];
const MALE_SIGNALS   = ['male', 'man', 'boy', 'david', 'alex', 'daniel', 'mark', 'james', 'oliver', 'fred', 'tom', 'gordon', 'arthur', 'lee', 'xander', 'rishi', 'ravi', 'hemant', 'madhur'];

export function scoreVoice(voice: SpeechSynthesisVoice, gender: 'female' | 'male', keywords: string[]): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  // Preferred keyword match = highest priority (index 0 = most preferred)
  keywords.forEach((kw, i) => {
    if (name.includes(kw.toLowerCase()) || lang.includes(kw.toLowerCase())) {
      score += 1000 - i * 10;
    }
  });

  // Prefer Hindi voices only when keywords include 'hindi' / 'hi-in'
  const wantsHindi = keywords.some((k) => k.toLowerCase().includes('hindi') || k.toLowerCase().includes('hi-in'));
  if (wantsHindi && lang.startsWith('hi')) score += 800;

  // Gender signal match (only applies when multiple Hindi voices exist)
  const signals = gender === 'female' ? FEMALE_SIGNALS : MALE_SIGNALS;
  const oppositeSignals = gender === 'female' ? MALE_SIGNALS : FEMALE_SIGNALS;
  signals.forEach((s) => { if (name.includes(s)) score += 200; });
  oppositeSignals.forEach((s) => { if (name.includes(s)) score -= 500; });

  // English fallback preference
  if (lang === 'en-gb') score += 30;
  if (lang === 'en-us') score += 20;
  if (lang.startsWith('en')) score += 10;

  // Network/non-local voices are usually higher quality
  if (!voice.localService) score += 5;

  return score;
}

function findBestVoice(settings: VoiceSettings): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  // Prefer Hindi + English voices; fall back to all voices
  const hindiVoices  = voices.filter((v) => v.lang.startsWith('hi'));
  const engHinVoices = voices.filter((v) => v.lang.startsWith('en') || v.lang.startsWith('hi'));
  const pool = engHinVoices.length > 0 ? engHinVoices : voices;
  if (hindiVoices.length > 0) {
    console.log(`[Voice] Hindi voices found:`, hindiVoices.map((v) => `${v.name} (${v.lang})`).join(' | '));
  }

  // Score every voice
  const scored = pool
    .map((v) => ({ voice: v, score: scoreVoice(v, settings.gender, settings.preferredKeywords) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.voice ?? null;

  // Debug log so you can see which voice is actually picked
  console.log(`[Voice ${settings.gender}] Available:`, pool.map((v) => v.name).join(' | '));
  console.log(`[Voice ${settings.gender}] Selected:`, best?.name ?? 'none', '(lang:', best?.lang ?? '-', ')');

  return best;
}

/**
 * Resolved voices, keyed by what actually determines the choice.
 *
 * This used to be keyed by gender alone, which meant the first female
 * character to speak decided the voice for every female character after her —
 * their preferredKeywords were never consulted again, so Naina and Jean came
 * out identical no matter how differently they were configured.
 */
const voiceCache = new Map<string, SpeechSynthesisVoice | null>();

function cacheKey(settings: VoiceSettings): string {
  return `${settings.gender}|${settings.preferredKeywords.join(',')}`;
}

function getVoice(settings: VoiceSettings, onReady: (v: SpeechSynthesisVoice | null) => void) {
  const key = cacheKey(settings);
  if (voiceCache.has(key)) {
    onReady(voiceCache.get(key) ?? null);
    return;
  }

  const resolve = () => {
    const v = findBestVoice(settings);
    voiceCache.set(key, v);
    onReady(v);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    resolve();
    return;
  }

  // Voices aren't loaded yet. addEventListener rather than assigning
  // onvoiceschanged: two characters waiting at once would otherwise overwrite
  // each other's handler and one would never get its voice.
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    // Anything resolved against an empty list was a guess — start clean.
    voiceCache.clear();
    resolve();
  }, { once: true });
}

/**
 * Which browser voice this character would actually get on this device, and
 * whether it's the accent the character asked for.
 *
 * Voice availability is a property of the phone, not of the app — the en-IN
 * voices are an optional download on Android. Rather than silently sounding
 * wrong, this lets the UI say which voice is in use and point at the fix.
 *
 * Returns null while the voice list is still loading, which it often is right
 * after page load; callers should re-check on the voiceschanged event.
 */
export function describeVoice(settings: VoiceSettings): { name: string; lang: string; matchesPreferredAccent: boolean } | null {
  if (!isSpeechSynthesisSupported()) return null;
  if (window.speechSynthesis.getVoices().length === 0) return null;

  const voice = findBestVoice(settings);
  if (!voice) return null;

  // Only meaningful for characters that actually asked for an accent.
  const wantsIndian = settings.preferredKeywords.some((k) => /en-in|india|hindi|hi-in/i.test(k));
  const isIndian = /^(en-in|hi)/i.test(voice.lang);

  return { name: voice.name, lang: voice.lang, matchesPreferredAccent: !wantsIndian || isIndian };
}

/** Runs `onChange` whenever the device's voice list becomes available. */
export function onVoicesReady(onChange: () => void): () => void {
  if (!isSpeechSynthesisSupported()) return () => {};
  const handler = () => onChange();
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}

export function speak(
  text: string,
  voiceSettings: VoiceSettings,
  callbacks?: SpeechCallbacks,
  useKokoro = false
): void {
  const cleanText = stripEmojisAndClean(text);
  if (!cleanText) { callbacks?.onEnd?.(); return; }

  window.speechSynthesis?.cancel();
  stopKokoro();

  if (useKokoro) {
    speakWithKokoro(cleanText, voiceSettings, callbacks).then((ok) => {
      if (!ok) speakWithBrowser(cleanText, voiceSettings, callbacks);
    });
    return;
  }

  speakWithBrowser(cleanText, voiceSettings, callbacks);
}

function speakWithBrowser(
  cleanText: string,
  voiceSettings: VoiceSettings,
  callbacks?: SpeechCallbacks
): void {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.('Speech synthesis not supported');
    return;
  }

  getVoice(voiceSettings, (voice) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (voice) utterance.voice = voice;
    utterance.rate   = voiceSettings.rate;
    utterance.pitch  = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;

    utterance.onstart = () => callbacks?.onStart?.();
    utterance.onend   = () => callbacks?.onEnd?.();
    utterance.onerror = (e) => callbacks?.onError?.(e.error);

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
  stopKokoro();
}

export interface RecordingHandle {
  /** Stops recording and resolves with the recorded audio blob. */
  stop: () => Promise<Blob>;
  /** Aborts recording without producing a usable result. */
  cancel: () => void;
}

/**
 * Starts recording microphone audio via MediaRecorder. Optionally reports a
 * live 0–1 amplitude level (via Web Audio's AnalyserNode) for a waveform UI.
 */
export async function startRecording(onLevel?: (level: number) => void): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  let rafId: number | null = null;
  let audioCtx: AudioContext | null = null;

  if (onLevel) {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      onLevel(Math.min(1, avg / 110));
      rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  mediaRecorder.start();

  const cleanup = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    audioCtx?.close().catch(() => { /* ignore */ });
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: () => new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        cleanup();
        resolve(new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }));
      };
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }),
    cancel: () => {
      mediaRecorder.onstop = null;
      try { if (mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch { /* ignore */ }
      cleanup();
    },
  };
}

/** Sends recorded audio to /api/transcribe (Groq Whisper) and returns the transcript. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('audio', blob, 'voice-note.webm');
    const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
    if (!res.ok) return '';
    const data = await res.json() as { text?: string };
    return data.text ?? '';
  } catch {
    return '';
  }
}
