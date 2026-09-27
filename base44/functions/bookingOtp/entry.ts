import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isValidEmail } from '../../shared/reservationEmail.ts';

function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Public booking email verification: anyone with a company booking link can
// request a reservation, so we verify the requester actually controls the
// email they entered by sending a 6-digit OTP they must enter before the
// reservation is created. Codes (and verified status) are stored in the
// EmailOtp entity via the service role (no authenticated user here).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const action = body?.action;
    const email = (body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return Response.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    if (action === 'send') {
      const name = (body?.name || '').trim() || 'there';
      const code = genCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.EmailOtp.create({
        email,
        code,
        purpose: 'booking',
        verified: false,
        expires_at: expiresAt
      });
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: 'Your AdReserve booking verification code',
          body: [
            `Hi ${name},`,
            '',
            `Your verification code is: ${code}`,
            '',
            'Enter this code on the booking page to confirm your reservation request.',
            'This code expires in 10 minutes.',
            '',
            "If you didn't request this, you can ignore this email."
          ].join('\n')
        });
      } catch (e) {
        return Response.json({ error: 'Could not send verification email: ' + (e && e.message ? e.message : String(e)) }, { status: 500 });
      }
      return Response.json({ sent: true });
    }

    if (action === 'verify') {
      const code = (body?.code || '').trim();
      if (!/^\d{6}$/.test(code)) {
        return Response.json({ error: 'Enter the 6-digit code from your email.' }, { status: 400 });
      }
      const records = await base44.asServiceRole.entities.EmailOtp.filter({ email });
      const now = Date.now();
      const valid = records
        .filter((r) => !r.verified && new Date(r.expires_at).getTime() > now)
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())[0];
      if (!valid) {
        return Response.json({ error: 'No valid code found. Please request a new code.' }, { status: 404 });
      }
      if (valid.code !== code) {
        return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.EmailOtp.update(valid.id, { verified: true });
      return Response.json({ verified: true, email });
    }

    return Response.json({ error: 'Unknown action. Use "send" or "verify".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}