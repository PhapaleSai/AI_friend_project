import type { CharacterId } from './characters';

export type { CharacterId };

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface StoredConversation {
  messages: Message[];
  lastUpdated: string;
  memoryContext: string;
}
