/**
 * Tone preference — shared by the profile UI and the chat route.
 *
 * Deliberately NOT marked 'use client'. It used to live in lib/profile.ts,
 * which is client-only because it touches localStorage; calling
 * toneInstruction() from the API route therefore threw at runtime, but only
 * for users who had actually picked a tone, since the call sits behind a
 * truthiness check. Anything both sides need belongs here instead.
 */

export type Tone = 'default' | 'gentle' | 'blunt' | 'hype';

export const TONE_LABELS: Record<Tone, string> = {
  default: 'Default',
  gentle: 'Extra gentle',
  blunt: 'Blunt & direct',
  hype: 'High energy',
};

export function toneInstruction(tone: Tone): string {
  switch (tone) {
    case 'gentle':
      return 'Speak extra gently and reassuringly with this person — they prefer a soft, patient tone over bluntness.';
    case 'blunt':
      return 'This person prefers blunt, direct talk — skip the cushioning and get to the point.';
    case 'hype':
      return 'This person likes high energy — bring more enthusiasm and hype into your replies.';
    default:
      return '';
  }
}
