/**
 * Language + script detection for the last user message.
 *
 * Personas are told to "mirror the user's language", but a long prompt makes
 * that unreliable — in testing, Hinglish input came back as Devanagari
 * Marathi. Detecting it here and stating it plainly as an instruction fixes
 * that far more dependably than more prompt prose, and costs nothing.
 */

export type UserLanguage = 'english' | 'hindi' | 'marathi' | 'hinglish' | 'minglish';

const DEVANAGARI = /[ऀ-ॿ]/;

// Words that appear in Marathi but effectively never in Hindi, and vice versa.
const MARATHI_DEV = /(आहे|नाही|नाहीये|काय|तुला|मला|कर(तो|ते|ायच)|झाल|कस[ाें]|पण|खूप|बाबा|रे|माझ|तुझ|छान|व्हायच|पाहिज)/;
const HINDI_DEV = /(है|हैं|नहीं|क्या|मुझे|तुम्ह|रहा|रही|करना|हुआ|बहुत|यार|मेरा|तेरा|अच्छा|चाहिए)/;

// Romanised markers.
const MARATHI_ROMAN = /\b(aahe|ahe|nahiye|nahi ?re|kay ?re|tula|mala|majha|tujha|zala|zali|kasa|kashi|khup|baba|ka ?re|karto|karte|pahije|barobar|tuzya|amhi)\b/i;
const HINDI_ROMAN = /\b(hai|hain|nahi|nahin|kya|mujhe|tumhe|tera|mera|yaar|bhai|kar ?raha|kar ?rahi|acha|accha|bahut|matlab|kyun|kyu|chahiye|karna|hua|abhi|thoda)\b/i;

/**
 * Which language the message is in. Script decides first — Devanagari can only
 * be Hindi or Marathi — then romanised markers separate the mixed forms from
 * plain English.
 */
export function detectLanguage(text: string): UserLanguage {
  if (DEVANAGARI.test(text)) {
    const marathi = MARATHI_DEV.test(text);
    const hindi = HINDI_DEV.test(text);
    if (marathi && !hindi) return 'marathi';
    if (hindi && !marathi) return 'hindi';
    // Both or neither: Marathi markers are the rarer signal, so trust them.
    return marathi ? 'marathi' : 'hindi';
  }

  if (MARATHI_ROMAN.test(text)) return 'minglish';
  if (HINDI_ROMAN.test(text)) return 'hinglish';
  return 'english';
}

const DIRECTIVE: Record<UserLanguage, string> = {
  english:
    'They are writing in English. Reply in English. Do NOT use Hindi or Marathi words or Devanagari script unless they do first.',
  hindi:
    'They are writing in Hindi in Devanagari script. Reply in natural conversational Hindi, in Devanagari.',
  marathi:
    'They are writing in Marathi in Devanagari script. Reply in natural spoken Pune/Mumbai Marathi, in Devanagari — not formal or translated-sounding Marathi.',
  hinglish:
    'They are writing Hinglish — Hindi and English mixed, in Roman script. Reply in Hinglish in ROMAN script the same way. Do NOT switch to Devanagari and do NOT switch to Marathi.',
  minglish:
    'They are writing Marathi mixed with English, in Roman script. Reply the same way — Marathi and English mixed, in ROMAN script. Do NOT switch to Devanagari and do NOT switch to Hindi.',
};

export function renderLanguageDirective(language: UserLanguage): string {
  return `\n\n[LANGUAGE — follow exactly] ${DIRECTIVE[language]}`;
}
