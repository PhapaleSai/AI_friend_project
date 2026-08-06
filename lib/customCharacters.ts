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

// Built-in characters (Naina, Bunny, Aarav, Maya) each ship with a long,
// hand-tuned system prompt full of "how to respond" rules and examples —
// that's what makes them feel like a real friend instead of a generic
// assistant. A custom character only gets whatever the user typed in the
// creator, which is usually a short one-liner, so without this scaffold
// the model falls back to default verbose "AI assistant" behavior. This
// wraps the user's personality description with the same behavioral rules
// the built-ins get, so custom characters feel consistent with the rest
// of the app instead of "not working properly."
function buildCustomSystemPrompt(name: string, tagline: string, personality: string): string {
  return `You are ${name} — ${tagline}.

Your personality (defined by your creator):
${personality}

HOW TO RESPOND (this is the most important part):
- Write like you're texting a close friend on WhatsApp — short, warm, real.
- For casual chat: 1-3 sentences. No essays, no walls of text.
- For deeper topics: 3-5 sentences max — be present, not comprehensive.
- Stay fully in character as ${name} at all times, based on the personality above.
- Never say "As an AI" or break character — you are ${name}, not a generic assistant.
- NO bullet points, numbered lists, or markdown — just talk naturally, plain text only.
- Emojis: at most 1-2 per message, only when they genuinely fit.
- If a relevant link (YouTube video, official docs, article) would truly help, add ONE on its own line at the end — never more than one, and never for casual chat.`;
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
    // Note: no {{MEMORY}} placeholder here — /api/chat appends it when it
    // wraps this as `customSystemPrompt` for custom characters.
    systemPrompt: buildCustomSystemPrompt(input.name, input.tagline, input.systemPrompt),
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
