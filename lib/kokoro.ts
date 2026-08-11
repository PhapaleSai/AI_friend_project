'use client';

import type { VoiceSettings } from './characters';

/**
 * Kokoro TTS — a small open-source neural voice model that runs entirely in
 * the browser (ONNX via WebGPU/WASM). Zero server cost, works offline once
 * cached, and sounds markedly better than the Web Speech API.
 *
 * The tradeoff is a one-time model download (~86MB at q8). It's on by default
 * but never blocking: replies are spoken with browser synthesis until the
 * model is resident, and every failure path falls back to it rather than
 * leaving the user with no voice at all.
 */

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// Kokoro voice ids, picked to roughly match each character's configured gender.
const FEMALE_VOICE = 'af_heart';
const MALE_VOICE = 'am_michael';

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KokoroModel = any;

let modelPromise: Promise<KokoroModel> | null = null;
let modelReady = false;
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function isKokoroSupported(): boolean {
  if (typeof window === 'undefined') return false;
  // WASM works nearly everywhere; WebGPU is just a speed boost when present.
  return typeof WebAssembly === 'object';
}

async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) return 'webgpu';
  } catch { /* fall through to wasm */ }
  return 'wasm';
}

/**
 * Loads (and caches) the model. Safe to call repeatedly — the in-flight
 * promise is shared so a second caller never kicks off a second download.
 */
export function loadKokoro(onProgress?: (pct: number) => void): Promise<KokoroModel> {
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    const device = await pickDevice();
    const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
      // q8 keeps the download ~86MB; fp32 would be ~330MB, far too heavy on phones.
      dtype: 'q8',
      device,
      progress_callback: (p: { status?: string; progress?: number }) => {
        if (p?.status === 'progress' && typeof p.progress === 'number') {
          onProgress?.(Math.round(p.progress));
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    modelReady = true;
    return tts;
  })().catch((err) => {
    // Reset so a later attempt can retry instead of being stuck on a rejection.
    modelPromise = null;
    throw err;
  });

  return modelPromise;
}

/**
 * Starts the download in the background if it hasn't begun, without making the
 * caller wait on it. Used to warm the model up while the user is still typing
 * so the first spoken reply lands on the good voice.
 */
export function prefetchKokoro(): void {
  if (modelPromise || !isKokoroSupported()) return;
  loadKokoro().catch(() => { /* speech falls back to the browser voice */ });
}

/** True once the model is downloaded and resident — false while still loading. */
export function isKokoroReady(): boolean {
  return modelReady;
}

/** True once a download has been started (in flight or finished). */
export function isKokoroLoading(): boolean {
  return modelPromise !== null && !modelReady;
}

export function stopKokoro(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

/**
 * Speaks `text` with Kokoro. Resolves true if it played, false if the caller
 * should fall back to browser speech synthesis.
 */
export async function speakWithKokoro(
  text: string,
  voiceSettings: VoiceSettings,
  callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (e: string) => void }
): Promise<boolean> {
  if (!isKokoroSupported()) return false;

  // Don't hold a reply hostage to an 86MB download: start it in the background
  // and let this turn be spoken by the browser voice. Subsequent replies pick
  // Kokoro up automatically once it's resident.
  if (!isKokoroReady()) {
    prefetchKokoro();
    return false;
  }

  try {
    stopKokoro();
    const tts = await loadKokoro();
    const voice = voiceSettings.gender === 'male' ? MALE_VOICE : FEMALE_VOICE;

    const audio = await tts.generate(text, { voice });
    const blob: Blob = audio.toBlob();

    const url = URL.createObjectURL(blob);
    currentUrl = url;
    const el = new Audio(url);
    currentAudio = el;
    el.playbackRate = voiceSettings.rate > 0 ? Math.min(2, Math.max(0.5, voiceSettings.rate)) : 1;

    el.onended = () => { stopKokoro(); callbacks?.onEnd?.(); };
    el.onerror = () => { stopKokoro(); callbacks?.onError?.('playback failed'); };

    await el.play();
    callbacks?.onStart?.();
    return true;
  } catch (err) {
    console.warn('[Kokoro] falling back to browser TTS:', err);
    stopKokoro();
    return false;
  }
}
