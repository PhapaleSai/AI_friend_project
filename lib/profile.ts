'use client';

const STORAGE_KEY = 'friend-ai-profile';

export interface UserProfile {
  nickname: string;
  birthday: string; // YYYY-MM-DD, empty if unset
  tone: 'default' | 'gentle' | 'blunt' | 'hype';
  /** Opt in to the higher-quality on-device Kokoro voice (one-time ~86MB download). */
  betterVoice: boolean;
}

const DEFAULT_PROFILE: UserProfile = { nickname: '', birthday: '', tone: 'default', betterVoice: false };

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
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

export const TONE_LABELS: Record<UserProfile['tone'], string> = {
  default: 'Default',
  gentle: 'Extra gentle',
  blunt: 'Blunt & direct',
  hype: 'High energy',
};

export function toneInstruction(tone: UserProfile['tone']): string {
  switch (tone) {
    case 'gentle':
      return 'Speak extra gently and reassuringly with this person — they prefer a soft, patient tone over bluntness.';
    case 'blunt':
      return 'This person prefers blunt, direct talk — skip the cushioning and get to the point.';
    case 'hype':
      return 'This person likes high energy — bring more enthusiasm and hype into your replies.';
    default:
      return '';
  }
}
