'use client';

import type { VoiceSettings } from './characters';

type SpeechCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (e: string) => void;
};

type RecognitionCallbacks = {
  onResult: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (error: string) => void;
};

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function stripEmojisAndClean(text: string): string {
  return text
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

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

const FEMALE_SIGNALS = ['female', 'woman', 'girl', 'samantha', 'zira', 'victoria', 'karen', 'susan', 'fiona', 'moira', 'tessa', 'veena', 'allison', 'ava', 'kate', 'serena', 'rishi'];
const MALE_SIGNALS   = ['male', 'man', 'boy', 'david', 'alex', 'daniel', 'mark', 'james', 'oliver', 'fred', 'tom', 'gordon', 'arthur', 'lee', 'xander'];

function scoreVoice(voice: SpeechSynthesisVoice, gender: 'female' | 'male', keywords: string[]): number {
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

// Cache the resolved voice per gender so we don't re-scan on every message
const voiceCache: Partial<Record<'female' | 'male', SpeechSynthesisVoice | null>> = {};

function getVoice(settings: VoiceSettings, onReady: (v: SpeechSynthesisVoice | null) => void) {
  if (voiceCache[settings.gender] !== undefined) {
    onReady(voiceCache[settings.gender] ?? null);
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const v = findBestVoice(settings);
    voiceCache[settings.gender] = v;
    onReady(v);
  } else {
    // Voices not loaded yet — wait once
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      // Bust cache when voices finally load
      delete voiceCache['female'];
      delete voiceCache['male'];
      const v = findBestVoice(settings);
      voiceCache[settings.gender] = v;
      onReady(v);
    };
  }
}

export function speak(
  text: string,
  voiceSettings: VoiceSettings,
  callbacks?: SpeechCallbacks
): void {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.('Speech synthesis not supported');
    return;
  }

  window.speechSynthesis.cancel();

  const cleanText = stripEmojisAndClean(text);
  if (!cleanText) { callbacks?.onEnd?.(); return; }

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function startListening(callbacks: RecognitionCallbacks): (() => void) | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError('Speech recognition not supported. Try Chrome on Android or desktop.');
    return null;
  }

  const win = window as unknown as Record<string, AnyRecognition>;
  const SR: AnyRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
  const recognition: AnyRecognition = new SR();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: AnyRecognition) => {
    const result = event.results[event.results.length - 1];
    callbacks.onResult(result[0].transcript as string, result.isFinal as boolean);
  };
  recognition.onend   = () => callbacks.onEnd();
  recognition.onerror = (event: AnyRecognition) => callbacks.onError(event.error as string);

  recognition.start();
  return () => { try { recognition.stop(); } catch { /* ignore */ } };
}
