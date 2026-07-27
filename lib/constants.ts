// Shared between the client (parsing the stream) and the /api/chat route
// (appending it) — kept out of characters/route files so importing it from
// a client component never accidentally pulls in server-only code (groq-sdk).
export const SOURCES_DELIMITER = '\n§§SOURCES§§';
