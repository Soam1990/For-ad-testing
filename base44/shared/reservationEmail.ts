// Shared helpers for the reservation approval workflow: email notifications + audit trail.
// Used by createReservation and decideReservation backend functions.

const NOTIFY_EMAIL = 'ab.soam@outlook.com';

export function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

export function bookingDetailLines({ status, billboard_name, company_name, targets }) {
  const lines = [
    `Status: ${status}`,
    `Billboard Name: ${billboard_name}`,
    `Company: ${company_name || ''}`,
  ];
  (targets || []).forEach((t) => {
    lines.push(`Date: ${formatDateLabel(t.reservation_date)}`);
    lines.push(`Time of Booking: ${t.start_time} – ${t.end_time}`);
  });
  lines.push('Thank you for your request.');
  return lines;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

export async function sendReservationEmail(base44, { subject, lines }) {
  return sendEmailTo(base44, NOTIFY_EMAIL, subject, lines);
}

// Sends an email to an arbitrary recipient (e.g. the booking requester).
// Reaching a non-registered address requires a paid plan + custom domain,
// so failures are caught and surfaced (never thrown) so the workflow continues.
export async function sendEmailTo(base44, to, subject, lines) {
  try {
    const AMP = '&' + 'amp;';
    const LT = '&' + 'lt;';
    const GT = '&' + 'gt;';
    const escapeHtml = (s) => String(s)
      .replace(/&/g, AMP)
      .replace(/</g, LT)
      .replace(/>/g, GT);
    const text = lines.join('\n');
    const html = lines.map(escapeHtml).join('<br>');
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      html,
      text
    });
    return { emailSent: true, emailError: null };
  } catch (e) {
    const emailError = e && e.message ? e.message : String(e);
    console.error('Email send failed:', emailError);
    return { emailSent: false, emailError };
  }
}

export async function writeAudit(base44, { reservation_id, action, admin_user_id, admin_name, previous_status, new_status, reason }) {
  try {
    await base44.asServiceRole.entities.ReservationAudit.create({
      reservation_id,
      action,
      admin_user_id,
      admin_name: admin_name || '',
      previous_status: previous_status || '',
      new_status,
      reason: reason || '',
      action_date: new Date().toISOString()
    });
  } catch (e) {
    console.error('Audit record creation failed:', (e && e.message) ? e.message : String(e));
  }
}