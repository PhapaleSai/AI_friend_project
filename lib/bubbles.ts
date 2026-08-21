/**
 * Turning one model reply into a burst of chat bubbles.
 *
 * Kept out of the component so the splitting rules can be tested directly —
 * they are the whole feature, and getting them wrong chops sentences apart.
 */

const MAX_BUBBLES = 5;

/**
 * Splits a reply into one bubble per line. Personas with multiBubble are told
 * to write in short lines precisely because each line is a separate text, so
 * the line breaks already mark where the bubbles go. Only a stray single
 * character gets folded back — "ok" is a perfectly normal text on its own, and
 * so is a lone emoji, which is two UTF-16 units rather than one.
 */
export function splitIntoBubbles(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [text.trim()];

  const out: string[] = [];
  for (const line of lines) {
    if (out.length > 0 && line.length <= 1) out[out.length - 1] += ' ' + line;
    else out.push(line);
  }
  // Past the cap everything joins the final bubble, so nothing is dropped.
  if (out.length > MAX_BUBBLES) {
    return [...out.slice(0, MAX_BUBBLES - 1), out.slice(MAX_BUBBLES - 1).join('\n')];
  }
  return out;
}

/** Pause before the next bubble — roughly how long that line takes to type. */
export function bubbleDelay(text: string): number {
  return Math.min(1600, 320 + text.length * 22);
}
