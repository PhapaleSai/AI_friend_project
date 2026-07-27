import type { CharacterId } from './characters';

export type { CharacterId };

export type MessageRole = 'user' | 'assistant';

export interface ArticleSource {
  title: string;
  url: string;
  source?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  isVoiceNote?: boolean;
  audioUrl?: string;
  sources?: ArticleSource[];
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface StoredConversation {
  messages: Message[];
  lastUpdated: string;
  memoryFacts: string[];
}
