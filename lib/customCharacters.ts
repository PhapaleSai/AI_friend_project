'use client';

import { CHARACTERS, type CharacterConfig, type CharacterTheme, type VoiceSettings } from './characters';

const STORAGE_KEY = 'friend-ai-custom-characters';

export interface CustomCharacterInput {
  name: string;
  tagline: string;
  systemPrompt: string;
  avatarDataUrl: string;
  primaryColor: string;
  secondaryColor: string;
  gender: 'female' | 'male';
  rate: number;
  pitch: number;
}

function themeFromColors(primary: string, secondary: string): CharacterTheme {
  return {
    primary,
    secondary,
    orbIdle: `radial-gradient(circle at 40% 40%, ${secondary}, ${primary})`,
    orbListening: 'radial-gradient(circle at 40% 40%, #4ade80, #22c55e, #16a34a, #15803d)',
    orbThinking: `conic-gradient(from 0deg, ${primary}, ${secondary}, ${primary})`,
    orbSpeaking: `radial-gradient(circle at 40% 40%, ${secondary}, ${primary})`,
    orbGlowIdle: `0 0 40px ${primary}88, 0 0 80px ${secondary}55, 0 0 160px ${primary}30`,
    orbGlowListening: '0 0 40px rgba(74,222,128,0.6), 0 0 80px rgba(34,197,94,0.4), 0 0 160px rgba(74,222,128,0.2)',
    orbGlowSpeaking: `0 0 40px ${secondary}aa, 0 0 80px ${primary}55, 0 0 160px ${secondary}30`,
    userBubble: `linear-gradient(135deg, ${primary}80 0%, ${secondary}55 100%)`,
    userBubbleBorder: `${primary}55`,
    nameColor: secondary,
    tabActive: `${primary}2e`,
    avatarGradient: `radial-gradient(circle at 40% 40%, ${secondary}, ${primary})`,
  };
}

function voiceFromInput(input: CustomCharacterInput): VoiceSettings {
  return {
    elevenlabsVoiceId: '',
    elevenlabsStability: 0.5,
    elevenlabsSimilarity: 0.8,
    elevenlabsStyle: 0.3,
    rate: input.rate,
    pitch: input.pitch,
    volume: 1.0,
    gender: input.gender,
    preferredKeywords: input.gender === 'female'
      ? ['google uk english female', 'microsoft zira', 'samantha', 'zira', 'female', 'woman']
      : ['google uk english male', 'microsoft david', 'david', 'mark', 'male', 'man'],
  };
}

export function loadCustomCharacters(): CharacterConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CharacterConfig[];
  } catch {
    return [];
  }
}

function persist(list: CharacterConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

export function createCustomCharacter(input: CustomCharacterInput): CharacterConfig {
  const id = `custom-${Math.random().toString(36).slice(2, 10)}`;
  const config: CharacterConfig = {
    id,
    name: input.name,
    title: 'Custom Friend',
    subtitle: input.tagline,
    avatarPosition: 'center center',
    emoji: '✨',
    avatar: input.avatarDataUrl,
    // Note: the raw prompt has no {{MEMORY}} placeholder — /api/chat appends
    // it when it wraps this as `customSystemPrompt` for custom characters.
    systemPrompt: input.systemPrompt,
    theme: themeFromColors(input.primaryColor, input.secondaryColor),
    voiceSettings: voiceFromInput(input),
    suggestions: [],
    isCustom: true,
  };
  const list = loadCustomCharacters();
  list.push(config);
  persist(list);
  return config;
}

export function deleteCustomCharacter(id: string): void {
  persist(loadCustomCharacters().filter((c) => c.id !== id));
}

export function getAllCharacters(): Record<string, CharacterConfig> {
  const merged: Record<string, CharacterConfig> = { ...CHARACTERS };
  for (const custom of loadCustomCharacters()) merged[custom.id] = custom;
  return merged;
}
