'use client';

import type { Message, StoredConversation } from './types';
import type { CharacterId } from './characters';

const STORAGE_KEY = (id: CharacterId) => `friend-ai-${id}-v2`;
const MAX_STORED = 40;

export function loadConversation(characterId: CharacterId): StoredConversation {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEY(characterId));
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as StoredConversation;
    return parsed;
  } catch {
    return empty();
  }
}

export function saveConversation(characterId: CharacterId, messages: Message[], memoryContext: string): void {
  if (typeof window === 'undefined') return;
  try {
    const toStore: StoredConversation = {
      messages: messages.slice(-MAX_STORED),
      lastUpdated: new Date().toISOString(),
      memoryContext,
    };
    localStorage.setItem(STORAGE_KEY(characterId), JSON.stringify(toStore));
  } catch {
    // localStorage quota exceeded or unavailable — fail silently
  }
}

export function clearConversation(characterId: CharacterId): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY(characterId));
}

function empty(): StoredConversation {
  return { messages: [], lastUpdated: '', memoryContext: '' };
}

/**
 * Builds a compact memory context string by scanning messages for
 * mentions of user interests, preferences, and important facts.
 * This is injected into the system prompt so the AI "remembers" the user.
 */
export function buildMemoryContext(messages: Message[]): string {
  if (messages.length < 4) return '';

  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  const notes: string[] = [];

  // Music preferences
  if (/punjabi|sidhu|diljit|ap dhillon|karan aujla|shubh/.test(userMessages)) {
    notes.push('User loves Punjabi music');
  }
  if (/hindi song|bollywood|arijit|jubin|atif/.test(userMessages)) {
    notes.push('User enjoys Hindi/Bollywood music');
  }

  // Comedy / entertainment
  if (/standup|comedy|zakir|biswa|kenny|bassi|samay/.test(userMessages)) {
    notes.push('User enjoys Hindi standup comedy');
  }

  // Life areas
  if (/job|work|career|office|interview|salary/.test(userMessages)) {
    notes.push('User discusses work/career topics');
  }
  if (/study|exam|college|university|degree/.test(userMessages)) {
    notes.push('User is studying/in academics');
  }
  if (/startup|business|entrepreneur|idea/.test(userMessages)) {
    notes.push('User interested in entrepreneurship/startups');
  }
  if (/relationship|girlfriend|boyfriend|partner|crush/.test(userMessages)) {
    notes.push('User sometimes discusses relationships');
  }
  if (/gym|workout|fitness|health|diet/.test(userMessages)) {
    notes.push('User interested in fitness/health');
  }
  if (/politics|news|government|election/.test(userMessages)) {
    notes.push('User interested in current affairs and politics');
  }

  // Emotional patterns
  if (/stressed|anxious|worried|scared|nervous/.test(userMessages)) {
    notes.push('User sometimes experiences stress/anxiety');
  }
  if (/happy|excited|great|amazing|love/.test(userMessages)) {
    notes.push('User tends to be positive and enthusiastic');
  }

  return notes.length > 0 ? notes.join('. ') + '.' : '';
}
