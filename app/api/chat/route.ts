import Groq from 'groq-sdk';
import { CHARACTERS, buildSystemPrompt } from '@/lib/characters';
import type { CharacterId } from '@/lib/characters';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages, characterId, memoryContext, userName } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      characterId: CharacterId;
      memoryContext?: string;
      userName?: string;
    };

    const character = CHARACTERS[characterId] ?? CHARACTERS.naina;
    const systemPrompt = buildSystemPrompt(character, memoryContext ?? '', userName ?? '');

    const encoder = new TextEncoder();

    let groqStream;
    try {
      groqStream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
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
