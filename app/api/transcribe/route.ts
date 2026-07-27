import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof Blob)) {
      return Response.json({ error: 'No audio provided' }, { status: 400 });
    }

    const file = new File([audio], 'voice-note.webm', { type: audio.type || 'audio/webm' });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      response_format: 'json',
    });

    return Response.json({ text: transcription.text?.trim() ?? '' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('🔴 TRANSCRIBE ERROR:', msg);
    return Response.json({ error: 'Transcription failed', text: '' }, { status: 500 });
  }
}
