'use client';

const STORAGE_KEY = 'friend-ai-profile';

export interface UserProfile {
  nickname: string;
  birthday: string; // YYYY-MM-DD, empty if unset
  tone: 'default' | 'gentle' | 'blunt' | 'hype';
  /** Higher-quality on-device Kokoro voice. On by default; can be switched off. */
  betterVoice: boolean;
  /**
   * Marks that this profile has been through the "better voice is now the
   * default" migration. Without it we can't tell a user who deliberately
   * turned the voice off from one whose profile predates the default flip —
   * both store `betterVoice: false`, and we'd keep re-enabling it on them.
   */
  voiceDefaultApplied?: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  nickname: '',
  birthday: '',
  tone: 'default',
  betterVoice: true,
  voiceDefaultApplied: true,
};

export function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<UserProfile>;
    const profile = { ...DEFAULT_PROFILE, ...saved };
    // Profiles saved before the flip carry an explicit `betterVoice: false`
    // that only meant "the old default" — upgrade them once, then respect
    // whatever the user chooses from here on.
    if (!saved.voiceDefaultApplied) {
      profile.betterVoice = true;
      profile.voiceDefaultApplied = true;
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
