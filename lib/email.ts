import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const EMAIL_TRIGGERS = /\b(send (an? )?e-?mail|e-?mail (this|that|him|her|them|to|my)|draft (an? )?e-?mail|write (an? )?e-?mail|mail (bhej|kar de|likh))\b/i;

/** Cheap heuristic gate, same style as shouldSearch — avoids an extra model call on every message. */
export function shouldDraftEmail(userMessage: string): boolean {
  return EMAIL_TRIGGERS.test(userMessage);
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
}

export function isValidEmail(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

const DRAFT_PROMPT = `You draft emails for a user based on their chat request. Output ONLY a JSON object, nothing else, in this exact shape:
{"to": "...", "subject": "...", "body": "..."}

Rules:
- "to": the recipient's email address ONLY if the user explicitly stated one in the conversation. Otherwise use an empty string "" — never invent or guess an email address.
- "subject": a short, sensible subject line based on the request.
- "body": a well-written, complete email body in a normal polite tone, based on what the user asked for. Sign off with the user's name if known, otherwise no sign-off.
- No markdown, no extra commentary, no code fences — just the raw JSON object.`;

/** Drafts an email from recent chat context. Returns null if there's not enough to go on. */
export async function draftEmailFromConversation(
  messages: { role: 'user' | 'assistant'; content: string }[],
  userName: string
): Promise<EmailDraft | null> {
  try {
    const transcript = messages.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const context = userName ? `The user's name is ${userName}.\n\n${transcript}` : transcript;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: DRAFT_PROMPT },
        { role: 'user', content: context },
      ],
      max_tokens: 400,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EmailDraft>;
    if (!parsed.body || !parsed.body.trim()) return null;

    return { to: parsed.to?.trim() ?? '', subject: parsed.subject?.trim() ?? '', body: parsed.body.trim() };
  } catch (err) {
    console.error('Email draft error:', err);
    return null;
  }
}

export async function sendEmail(draft: EmailDraft): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'Email isn\'t configured yet (missing RESEND_API_KEY).' };
  if (!isValidEmail(draft.to)) return { success: false, error: 'That recipient address doesn\'t look valid.' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: draft.to,
        subject: draft.subject || '(no subject)',
        text: draft.body,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { success: false, error: (errBody as { message?: string }).message || `Resend error ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    console.error('Resend send error:', err);
    return { success: false, error: 'Failed to reach the email service.' };
  }
}
