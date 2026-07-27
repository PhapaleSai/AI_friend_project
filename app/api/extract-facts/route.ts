import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EXTRACTION_PROMPT = `You extract durable facts about a user from a chat transcript, for a companion AI's long-term memory.

Rules:
- Output ONLY short facts worth remembering across future conversations (preferences, ongoing plans, important dates, interests, recurring struggles).
- Skip small talk, one-off questions, and anything already obvious or temporary.
- Each fact: one short sentence, no trailing period, no numbering, no quotes.
- Maximum 6 facts. If nothing durable is worth remembering, output nothing.
- One fact per line. No other text, headers, or explanation.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length < 4) {
      return Response.json({ facts: [] });
    }

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
      .slice(-4000);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: transcript },
      ],
      max_tokens: 200,
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const facts = text
      .split('\n')
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 3 && line.length < 140)
      .slice(0, 6);

    return Response.json({ facts });
  } catch (err) {
    console.error('Fact extraction error:', err);
    return Response.json({ facts: [] });
  }
}
