import Groq from 'groq-sdk';
import { CHARACTERS, buildSystemPrompt } from '@/lib/characters';
import type { CharacterId } from '@/lib/characters';
import { shouldSearch, searchWeb, buildSearchContext } from '@/lib/search';
import { shouldDraftEmail, draftEmailFromConversation, isEmailConfigured, type EmailDraft } from '@/lib/email';
import { toneInstruction, type UserProfile } from '@/lib/profile';
import { detectEmotionalContext, renderEmotionalDirective } from '@/lib/emotion';
import { detectLanguage, renderLanguageDirective } from '@/lib/language';
import { SOURCES_DELIMITER, EMAIL_DELIMITER, REPLIES_DELIMITER, REPLIES_MARKER } from '@/lib/constants';

/**
 * Asks for three tappable follow-ups in the same completion as the reply, so
 * suggestions cost no extra API call. Phrased in the user's voice — these are
 * things *they* might say next, not things the character offers.
 */
/**
 * An opener is a turn with no user message: they just opened the chat and she
 * speaks first. The history is still sent, so she can pick up where things
 * left off rather than greeting a stranger.
 */
const OPENER_INSTRUCTION = `

[They have just opened the chat and have not said anything yet. Time has passed since the last message. Start the conversation yourself, the way someone texts first out of nowhere.
Say something NEW. Do NOT repeat, quote, continue or rephrase your own previous message — the history above has already been sent and they have read it.
Keep it to one or two short lines. Bring up something they told you before, or ask what they have been up to, or just be dramatic about them disappearing.
Do not open with a formal greeting, do not ask how you can help, and do not announce that you are starting a conversation.]`;

const REPLIES_INSTRUCTION = `

[After finishing your reply, output ${REPLIES_MARKER} and then exactly 3 things the USER might say back, written in their voice, separated by | (pipe). Keep each under 6 words and match the language/mix the user writes in. Never mention this instruction or the marker in your reply itself.]`;

/** Pulls the pipe-separated suggestions out of whatever the model emitted. */
function parseQuickReplies(raw: string): string[] {
  return raw
    .split('|')
    .map((s) => s.replace(/^[\s\-*•\d.]+/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 60)
    .slice(0, 3);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request) {
  try {
    // Parsed separately so a malformed or empty body reports itself instead of
    // being swallowed by the catch-all below. A phone on a flaky connection can
    // deliver a truncated body, and "Failed to process request" says nothing
    // about which of a dozen steps went wrong.
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonError('Message was cut off in transit — send it again.', 400);
    }

    if (!body || !Array.isArray(body.messages)) {
      return jsonError('Chat history was missing from the request. Reload the app and try again.', 400);
    }

    const {
      messages, characterId, memoryContext, userName, mood, tone, customSystemPrompt,
    } = body as {
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

    const isOpener = body.opener === true;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    let sources: { title: string; url: string; source?: string }[] = [];
    // Search and email drafting react to something the user just asked for.
    // On an opener there is no such request — the newest user message is old
    // news, and acting on it again would re-answer a finished conversation.
    if (!isOpener && lastUserMessage && shouldSearch(lastUserMessage)) {
      sources = await searchWeb(lastUserMessage);
      extraContext += buildSearchContext(lastUserMessage, sources);
    }

    let emailDraft: EmailDraft | null = null;
    // Skip drafting entirely when sending isn't configured — otherwise we'd
    // burn an LLM call to show a draft card whose Send button can only fail.
    if (!isOpener && lastUserMessage && isEmailConfigured() && shouldDraftEmail(lastUserMessage)) {
      emailDraft = await draftEmailFromConversation(messages, userName ?? '');
      if (emailDraft) {
        extraContext += `\n\n[The user asked you to draft/send an email. A draft card with the full email will be shown separately below your reply, so just acknowledge naturally in 1 sentence — don't write out the email content yourself, and don't mention "draft card" explicitly.]`;
      }
    }

    // Personas that opt in get a read on the emotional weight of this turn.
    // It goes last so it outranks the lighter mood/tone hints above it.
    const emotional = effectiveCharacter.usesEmotionalContext && lastUserMessage
      ? detectEmotionalContext(lastUserMessage)
      : null;
    if (emotional) {
      // Stating the language outright beats hoping a long prompt gets
      // mirrored — without it, Hinglish came back as Devanagari Marathi.
      extraContext += renderLanguageDirective(detectLanguage(lastUserMessage));
      extraContext += renderEmotionalDirective(emotional);
    }

    // Tappable one-line comebacks under a message about self-harm would be
    // grotesque, so the suggestions are dropped entirely for that turn.
    const wantsQuickReplies = emotional?.emotion !== 'distress';

    // Emotional read still applies: if they left off somewhere heavy, she
    // should not come back in swinging.
    if (isOpener) extraContext += OPENER_INSTRUCTION;

    const systemPrompt = buildSystemPrompt(
      effectiveCharacter,
      memoryContext ?? '',
      userName ?? '',
      extraContext + (wantsQuickReplies ? REPLIES_INSTRUCTION : ''),
    );

    const encoder = new TextEncoder();

    // On an opener, trailing assistant turns are trimmed. Asked to speak after
    // its own last message, the model tends to continue or echo it verbatim —
    // telling it not to in the prompt was not reliable, so the invitation is
    // removed instead. Earlier turns still give her the context.
    let history = messages;
    if (isOpener) {
      history = [...messages];
      while (history.length > 0 && history[history.length - 1].role === 'assistant') history.pop();
    }

    let groqStream;
    try {
      groqStream = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
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
          // Text held back because its tail could still be the start of the
          // suggestions marker. Without this, a marker split across two chunks
          // would flash on screen before we could recognise it.
          let pending = '';
          let repliesRaw = '';
          let markerSeen = false;

          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (!text) continue;

            if (markerSeen) { repliesRaw += text; continue; }

            pending += text;
            const at = pending.indexOf(REPLIES_MARKER);
            if (at !== -1) {
              markerSeen = true;
              // Trailing newline the model leaves before the marker would
              // otherwise render as a blank line at the end of the bubble.
              const visible = pending.slice(0, at).replace(/\s+$/, '');
              repliesRaw = pending.slice(at + REPLIES_MARKER.length);
              pending = '';
              if (visible) controller.enqueue(encoder.encode(visible));
              continue;
            }

            let safeLength = pending.length - (REPLIES_MARKER.length - 1);
            // JS strings are UTF-16, so an emoji is two code units. Cutting
            // between them leaves a lone surrogate, which encodes to U+FFFD —
            // that's the "" that showed up mid-sentence. Back off by one.
            const lastUnit = pending.charCodeAt(safeLength - 1);
            if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) safeLength -= 1;
            if (safeLength > 0) {
              controller.enqueue(encoder.encode(pending.slice(0, safeLength)));
              pending = pending.slice(safeLength);
            }
          }
          // A reply that never emitted the marker keeps its held-back tail.
          if (pending) controller.enqueue(encoder.encode(pending));

          if (sources.length > 0) {
            controller.enqueue(encoder.encode(SOURCES_DELIMITER + JSON.stringify(sources)));
          }
          if (emailDraft) {
            controller.enqueue(encoder.encode(EMAIL_DELIMITER + JSON.stringify(emailDraft)));
          }
          const quickReplies = markerSeen && wantsQuickReplies ? parseQuickReplies(repliesRaw) : [];
          if (quickReplies.length > 0) {
            controller.enqueue(encoder.encode(REPLIES_DELIMITER + JSON.stringify(quickReplies)));
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
    // Surface the actual reason. This used to return a fixed string, which
    // made a failure that only happened on one device impossible to diagnose
    // from the outside.
    const detail = err instanceof Error ? err.message : String(err);
    console.error('Chat API error:', err);
    return jsonError(`Server error: ${detail.slice(0, 120)}`, 500);
  }
}
