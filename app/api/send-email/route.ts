import { sendEmail, isValidEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json() as { to?: string; subject?: string; body?: string };

    if (!to || !isValidEmail(to)) {
      return Response.json({ success: false, error: 'Enter a valid recipient email address.' }, { status: 400 });
    }
    if (!body || !body.trim()) {
      return Response.json({ success: false, error: 'Email body is empty.' }, { status: 400 });
    }

    const result = await sendEmail({ to, subject: subject || '(no subject)', body });
    return Response.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    console.error('send-email route error:', err);
    return Response.json({ success: false, error: 'Failed to send email.' }, { status: 500 });
  }
}
