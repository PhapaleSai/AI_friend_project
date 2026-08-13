// Shared between the client (parsing the stream) and the /api/chat route
// (appending it) — kept out of characters/route files so importing it from
// a client component never accidentally pulls in server-only code (groq-sdk).
export const SOURCES_DELIMITER = '\n§§SOURCES§§';
export const EMAIL_DELIMITER = '\n§§EMAIL§§';
export const REPLIES_DELIMITER = '\n§§REPLIES§§';

/**
 * What the *model* is told to emit before its suggested user replies. Kept
 * separate from REPLIES_DELIMITER because the two do different jobs: this one
 * appears mid-stream and is stripped by the route, which then re-emits the
 * parsed result behind the real delimiter. Buffering it server-side is what
 * stops a half-received marker from flashing in the chat bubble.
 */
export const REPLIES_MARKER = '<<<REPLIES>>>';
