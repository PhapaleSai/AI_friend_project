'use client';

import type { VoiceSettings } from './characters';
import { stripMarkdown } from './textFormat';
import { speakWithKokoro, stopKokoro, primeAudioPlayback } from './kokoro';

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

/**
 * Whether this is a phone or tablet. Used only to choose between equally
 * valid options where the two behave differently — never to hide a feature.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (navigator.maxTouchPoints > 1 && !/Macintosh/.test(navigator.userAgent)) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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

  // On a desktop a network voice is usually the better-sounding one. On a
  // phone it is the one that fails: it needs a round trip to the vendor's
  // server for every reply and goes silent on a weak connection, so a locally
  // installed voice is the reliable pick there.
  if (isMobileDevice() ? voice.localService : !voice.localService) score += 5;

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
const voiceCache = new Map<string, string | null>();

// How long to wait for the device's voice list before speaking anyway.
const VOICE_LIST_TIMEOUT_MS = 1000;

function cacheKey(settings: VoiceSettings): string {
  return `${settings.gender}|${settings.preferredKeywords.join(',')}`;
}

/**
 * Resolves the chosen voice's *name*, not the voice object.
 *
 * Holding the object across turns looked equivalent and wasn't: Android
 * rebuilds its voice list in the background, and an utterance assigned a voice
 * from the old list is rejected without a sound and without an error. The name
 * is stable, so it is looked up against the live list at the moment of
 * speaking instead.
 */
function getVoiceName(settings: VoiceSettings, onReady: (name: string | null) => void) {
  const key = cacheKey(settings);
  if (voiceCache.has(key)) {
    onReady(voiceCache.get(key) ?? null);
    return;
  }

  const resolve = () => {
    const name = findBestVoice(settings)?.name ?? null;
    voiceCache.set(key, name);
    onReady(name);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    resolve();
    return;
  }

  // Voices aren't loaded yet. addEventListener rather than assigning
  // onvoiceschanged: two characters waiting at once would otherwise overwrite
  // each other's handler and one would never get its voice.
  //
  // Some mobile browsers (Android WebViews in particular) never fire
  // voiceschanged at all, so waiting on it alone meant no utterance was ever
  // created and the reply stayed silent with nothing reported. Whichever comes
  // first wins; past the deadline we speak in the device's default voice,
  // which is the right accent far more often than it is no voice at all.
  let settled = false;
  const settle = (cacheable: boolean) => {
    if (settled) return;
    settled = true;
    window.speechSynthesis.removeEventListener('voiceschanged', onChanged);
    clearTimeout(timer);
    if (cacheable) {
      // Anything resolved against an empty list was a guess — start clean.
      voiceCache.clear();
      resolve();
    } else {
      onReady(null);
    }
  };
  const onChanged = () => settle(true);
  const timer = setTimeout(() => settle(false), VOICE_LIST_TIMEOUT_MS);
  window.speechSynthesis.addEventListener('voiceschanged', onChanged);
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

let speechPrimed = false;

/**
 * Unlocks audio output for the rest of the page's life.
 *
 * Mobile browsers refuse both `speechSynthesis.speak` and `audio.play` unless
 * the page has already produced sound from inside a user gesture. Every reply
 * is spoken after awaiting the model, so by then the tap is over and the
 * speech is dropped without an error — the reply appeared as text and the
 * voice simply never arrived. Desktop has no such rule, which is why this only
 * showed up on a phone.
 *
 * Call this synchronously from a tap or click handler — anything `await`ed
 * first puts it outside the gesture and it stops working. Calling it on every
 * tap is fine; the work happens once.
 */
export function unlockAudio(): void {
  primeAudioPlayback();

  if (speechPrimed || !isSpeechSynthesisSupported()) return;
  speechPrimed = true;
  try {
    // A silent utterance: it counts as speech started by the tap, which is
    // what lifts the restriction, but nothing is heard.
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    window.speechSynthesis.speak(warmup);
  } catch {
    speechPrimed = false;
  }
}

/**
 * Chrome on Android abandons an utterance that runs much past ~15 seconds,
 * and when it does it never fires `end` — the engine stays wedged in a
 * speaking state where every later utterance queues behind it and is never
 * heard. That is why a voice that worked on the first reply went quiet for the
 * rest of the session. Speaking in sentence-sized pieces keeps every
 * utterance comfortably inside the limit.
 */
const MAX_CHUNK_CHARS = 180;

/** Settling time after a cancel before the engine will accept a new utterance. */
const CANCEL_SETTLE_MS = 120;

/** How long to give an utterance to start before assuming the engine is wedged. */
const UTTERANCE_START_TIMEOUT_MS = 1500;

/** Splits text into utterance-sized pieces, preferring sentence boundaries. */
export function chunkForSpeech(text: string): string[] {
  const pieces = text.match(/[^.!?\n]+[.!?]*|\n+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  const flushOversized = () => {
    while (current.length > MAX_CHUNK_CHARS) {
      // Break on a word boundary unless that would leave a stub, in which
      // case a hard cut is better than one enormous utterance.
      const space = current.lastIndexOf(' ', MAX_CHUNK_CHARS);
      const at = space > MAX_CHUNK_CHARS * 0.6 ? space : MAX_CHUNK_CHARS;
      chunks.push(current.slice(0, at).trim());
      current = current.slice(at).trim();
    }
  };

  for (const piece of pieces) {
    const sentence = piece.trim();
    if (!sentence) continue;
    if (current && current.length + sentence.length + 1 > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    flushOversized();
  }
  if (current) chunks.push(current);

  // Whitespace-only input yields nothing to say, which the caller handles by
  // finishing immediately rather than queueing a silent utterance.
  return chunks.length > 0 ? chunks : text.trim() ? [text.trim()] : [];
}

/**
 * Bumped by every new reply and every stop, so a queue that has been
 * superseded abandons itself instead of speaking over what replaced it.
 */
let speechGeneration = 0;

export function speak(
  text: string,
  voiceSettings: VoiceSettings,
  callbacks?: SpeechCallbacks,
  useKokoro = false
): void {
  const cleanText = stripEmojisAndClean(text);
  if (!cleanText) { callbacks?.onEnd?.(); return; }

  stopKokoro();

  if (useKokoro) {
    speakWithKokoro(cleanText, voiceSettings, callbacks).then((ok) => {
      if (!ok) startBrowserSpeech(cleanText, voiceSettings, callbacks);
    });
    return;
  }

  startBrowserSpeech(cleanText, voiceSettings, callbacks);
}

/**
 * Clears whatever is speaking, then starts the new reply.
 *
 * The cancel is deliberately not followed by a `speak` in the same tick:
 * Chrome drops an utterance queued that soon after a cancel, silently. The
 * first reply of a session had nothing to cancel and so was heard, and every
 * reply after it was cancelled into nothing — the whole of "it speaks once,
 * then never again".
 */
function startBrowserSpeech(
  cleanText: string,
  voiceSettings: VoiceSettings,
  callbacks?: SpeechCallbacks
): void {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.('Speech synthesis not supported');
    return;
  }

  const synth = window.speechSynthesis;
  speechGeneration += 1; // abandon anything already queued

  if (synth.speaking || synth.pending || synth.paused) {
    synth.cancel();
    setTimeout(() => speakWithBrowser(cleanText, voiceSettings, callbacks), CANCEL_SETTLE_MS);
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

  const synth = window.speechSynthesis;
  const generation = speechGeneration;

  getVoiceName(voiceSettings, (voiceName) => {
    if (generation !== speechGeneration) return;

    const chunks = chunkForSpeech(cleanText);
    let index = 0;
    let announcedStart = false;

    // `isRetry` means this piece is a second attempt: it drops the chosen
    // voice in favour of the device default (the likeliest thing to be at
    // fault) and gives up rather than retrying forever.
    const speakChunk = (isRetry = false): void => {
      if (generation !== speechGeneration) return;
      if (index >= chunks.length) { callbacks?.onEnd?.(); return; }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      const voice = !isRetry && voiceName
        ? synth.getVoices().find((v) => v.name === voiceName)
        : undefined;
      if (voice) {
        utterance.voice = voice;
        // Some engines ignore `voice` unless `lang` agrees with it.
        utterance.lang = voice.lang;
      }
      utterance.rate   = voiceSettings.rate;
      utterance.pitch  = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;

      let settled = false;
      let startTimer: ReturnType<typeof setTimeout> | undefined;

      utterance.onstart = () => {
        clearTimeout(startTimer);
        if (!announcedStart) { announcedStart = true; callbacks?.onStart?.(); }
      };

      utterance.onend = () => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimer);
        index += 1;
        speakChunk();
      };

      utterance.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(startTimer);
        if (generation !== speechGeneration) return;
        // Our own cancel, because a newer reply is taking over: not a failure.
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        if (!isRetry) { speakChunk(true); return; }
        callbacks?.onError?.(e.error);
      };

      // iOS leaves the engine paused when the page goes to the background and
      // nothing resumes it on the way back, so coming back to the tab found a
      // voice that would never speak again.
      if (synth.paused) synth.resume();
      synth.speak(utterance);

      // An utterance that neither starts nor errors means the engine is
      // wedged. Resetting it and re-queueing recovers the voice, where before
      // the reply simply stayed silent with nothing reported.
      startTimer = setTimeout(() => {
        if (settled || generation !== speechGeneration) return;
        if (synth.speaking || synth.pending) return; // working, just slow to report
        settled = true;
        if (isRetry) { callbacks?.onError?.('speech-unavailable'); return; }
        synth.cancel();
        setTimeout(() => { if (generation === speechGeneration) speakChunk(true); }, CANCEL_SETTLE_MS);
      }, UTTERANCE_START_TIMEOUT_MS);
    };

    speakChunk();
  });
}

export function stopSpeaking(): void {
  speechGeneration += 1;
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
