import Groq from 'groq-sdk';
import { CHARACTERS, buildSystemPrompt } from '@/lib/characters';
import type { CharacterId } from '@/lib/characters';
import { shouldSearch, searchWeb, buildSearchContext } from '@/lib/search';
import { toneInstruction, type UserProfile } from '@/lib/profile';
import { SOURCES_DELIMITER } from '@/lib/constants';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const {
      messages, characterId, memoryContext, userName, mood, tone, customSystemPrompt,
    } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      characterId: CharacterId;
      memoryContext?: string;
      userName?: string;
      mood?: string;
      tone?: UserProfile['tone'];
      customSystemPrompt?: string;
    };

    const character = CHARACTERS[characterId as keyof typeof CHARACTERS] ?? CHARACTERS.naina;
    const effectiveCharacter = customSystemPrompt
      ? { ...character, systemPrompt: `${customSystemPrompt}\n\n{{MEMORY}}` }
      : character;

    let extraContext = '';
    if (mood) extraContext += `\n\nThe user's current mood check-in: ${mood}. Let this subtly inform your tone, without explicitly mentioning "mood check-in".`;
    if (tone) {
      const instruction = toneInstruction(tone);
      if (instruction) extraContext += `\n\n${instruction}`;
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    let sources: { title: string; url: string; source?: string }[] = [];
    if (lastUserMessage && shouldSearch(lastUserMessage)) {
      sources = await searchWeb(lastUserMessage);
      extraContext += buildSearchContext(lastUserMessage, sources);
    }

    const systemPrompt = buildSystemPrompt(effectiveCharacter, memoryContext ?? '', userName ?? '', extraContext);

    const encoder = new TextEncoder();

    let groqStream;
    try {
      groqStream = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 1024,
        temperature: 0.85,
        stream: true,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('🔴 GROQ ERROR:', msg);
      const friendly = msg.includes('401') || msg.includes('invalid_api_key')
        ? '🔑 Invalid API key. Check GROQ_API_KEY in .env.local'
        : msg.includes('429') || msg.includes('rate_limit')
        ? '⏳ Rate limited. Wait a moment and try again.'
        : `Error: ${msg.slice(0, 150)}`;
      return new Response(JSON.stringify({ error: friendly }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
          if (sources.length > 0) {
            controller.enqueue(encoder.encode(SOURCES_DELIMITER + JSON.stringify(sources)));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
