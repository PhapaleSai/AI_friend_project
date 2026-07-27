/**
 * Strips markdown syntax the model sometimes slips into replies (headings,
 * bold/italic markers, inline code, bullet/numbered list markers) so chat
 * bubbles and TTS never show/speak literal "#", "**", "`" characters.
 * This is a plain-text chat UI, not a markdown renderer.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_\n]+?)_(?!_)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*[-*+]\s+/gm, '')
    .replace(/^[ \t]*\d+\.\s+/gm, '');
}
