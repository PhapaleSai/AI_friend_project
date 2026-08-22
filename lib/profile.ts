'use client';

import type { Tone } from './tone';

// Re-exported so existing client callers keep their import path.
export { TONE_LABELS, toneInstruction, type Tone } from './tone';

const STORAGE_KEY = 'friend-ai-profile';

export interface UserProfile {
  nickname: string;
  birthday: string; // YYYY-MM-DD, empty if unset
  tone: Tone;
  /** Opt in to the higher-quality on-device Kokoro voice (one-time ~86MB download). */
  betterVoice: boolean;
  /**
   * Legacy marker from the brief period when the neural voice was on by
   * default. Only still read to undo that — see loadProfile.
   */
  voiceDefaultApplied?: boolean;
}

const DEFAULT_PROFILE: UserProfile = { nickname: '', birthday: '', tone: 'default', betterVoice: false };

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<UserProfile>;
    const profile = { ...DEFAULT_PROFILE, ...saved };
    // The neural voice was default-on for one release and made phones crawl.
    // Switching the default back isn't enough on its own — those profiles have
    // `betterVoice: true` written to localStorage and would stay slow. Turn it
    // off once for anyone auto-enabled, then drop the marker and persist, so a
    // deliberate re-enable later is never clobbered.
    if (saved.voiceDefaultApplied) {
      profile.betterVoice = false;
      delete profile.voiceDefaultApplied;
      saveProfile(profile);
    }
    return profile;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}
