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
    rawPersonality: input.systemPrompt,
  };
  const list = loadCustomCharacters();
  list.push(config);
  persist(list);
  return config;
}

export function deleteCustomCharacter(id: string): void {
  persist(loadCustomCharacters().filter((c) => c.id !== id));
}

/* ─── Sharing ──────────────────────────────────────────────────────────
   A share code is just base64(JSON) of the same CustomCharacterInput used
   to create a character locally. Importing runs it back through
   createCustomCharacter(), so a shared character is rebuilt by exactly
   the same code path as a locally-made one — nothing from the payload is
   trusted as-is. See validateSharedInput() for what gets checked.
─────────────────────────────────────────────────────────────────────── */

const SHARE_PREFIX = 'FRIENDAI1:';

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const CHUNK = 0x8000; // avoid blowing the call stack on large avatars
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Recovers the raw personality text from a wrapped prompt (pre-rawPersonality characters). */
function extractPersonality(systemPrompt: string): string {
  const match = systemPrompt.match(/Your personality \(defined by your creator\):\n([\s\S]*?)\n\nHOW TO RESPOND/);
  return match ? match[1].trim() : systemPrompt;
}

/**
 * Re-encodes the avatar smaller for sharing. The stored 200px avatar makes
 * a ~27,000-character share code, which is impractical to paste into a chat;
 * 96px at moderate quality brings that down to a few thousand characters
 * while still looking fine at the sizes avatars actually render (32–128px).
 */
function shrinkAvatarForSharing(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.onerror = () => resolve(dataUrl); // fall back to the original
    img.onload = () => {
      try {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}

export async function exportCharacterCode(config: CharacterConfig): Promise<string> {
  const input: CustomCharacterInput = {
    name: config.name,
    tagline: config.subtitle,
    systemPrompt: config.rawPersonality ?? extractPersonality(config.systemPrompt),
    avatarDataUrl: await shrinkAvatarForSharing(config.avatar),
    primaryColor: config.theme.primary,
    secondaryColor: config.theme.secondary,
    gender: config.voiceSettings.gender,
    rate: config.voiceSettings.rate,
    pitch: config.voiceSettings.pitch,
  };
  return SHARE_PREFIX + toBase64(JSON.stringify(input));
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Only inline image data URLs — never a remote URL (which would leak the
// viewer's IP to whoever made the code) and never a script-bearing scheme.
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

function validateSharedInput(raw: unknown): CustomCharacterInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 20) : '';
  const tagline = typeof o.tagline === 'string' ? o.tagline.trim().slice(0, 40) : '';
  const systemPrompt = typeof o.systemPrompt === 'string' ? o.systemPrompt.trim().slice(0, 4000) : '';
  const avatarDataUrl = typeof o.avatarDataUrl === 'string' ? o.avatarDataUrl : '';

  if (!name || !systemPrompt) return null;
  if (!DATA_IMAGE.test(avatarDataUrl)) return null;

  const primaryColor = typeof o.primaryColor === 'string' && HEX_COLOR.test(o.primaryColor) ? o.primaryColor : '#8b5cf6';
  const secondaryColor = typeof o.secondaryColor === 'string' && HEX_COLOR.test(o.secondaryColor) ? o.secondaryColor : '#ec4899';
  const gender = o.gender === 'male' ? 'male' : 'female';
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  return {
    name,
    tagline: tagline || 'Your custom AI friend',
    systemPrompt,
    avatarDataUrl,
    primaryColor,
    secondaryColor,
    gender,
    rate: clamp(o.rate, 0.5, 2, 1),
    pitch: clamp(o.pitch, 0, 2, gender === 'female' ? 1.2 : 0.85),
  };
}

export function importCharacterCode(code: string): CharacterConfig | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith(SHARE_PREFIX)) return null;
    const parsed = JSON.parse(fromBase64(trimmed.slice(SHARE_PREFIX.length)));
    const input = validateSharedInput(parsed);
    if (!input) return null;
    return createCustomCharacter(input);
  } catch {
    return null;
  }
}

export function getAllCharacters(): Record<string, CharacterConfig> {
  const merged: Record<string, CharacterConfig> = { ...CHARACTERS };
  for (const custom of loadCustomCharacters()) merged[custom.id] = custom;
  return merged;
}
