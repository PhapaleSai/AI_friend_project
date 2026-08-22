import type { CharacterId } from './characters';

export type { CharacterId };

export type MessageRole = 'user' | 'assistant';

export interface ArticleSource {
  title: string;
  url: string;
  source?: string;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  isVoiceNote?: boolean;
  audioUrl?: string;
  sources?: ArticleSource[];
  emailDraft?: EmailDraft;
  /** Tappable follow-ups, in the user's voice. Only shown under the latest reply. */
  quickReplies?: string[];
  /**
   * Delivery state of a message you sent, shown as ticks. Mapped to states the
   * app can actually observe rather than invented: sent means it's in the
   * thread, delivered means the server accepted it and the reply is streaming,
   * read means the reply arrived.
   */
  status?: 'sent' | 'delivered' | 'read';
  /** ISO timestamp. Optional — messages saved before this field existed won't have it. */
  createdAt?: string;
}

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface StoredConversation {
  messages: Message[];
  lastUpdated: string;
  memoryFacts: string[];
}
