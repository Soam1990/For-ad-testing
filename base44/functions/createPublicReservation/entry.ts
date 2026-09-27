import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendReservationEmail, sendEmailTo, isValidEmail, writeAudit, formatDateLabel, bookingDetailLines } from '../../shared/reservationEmail.ts';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Public (no-login) reservation request: anyone with a company's booking link
// can submit a pending request. The requester's name + company are captured in
// the form so the company admin can identify who asked. The reservation is
// attached to the HOLDING's company (not the requester), created via service
// role since there is no authenticated user to satisfy RLS.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      holding_id,
      reservation_date,
      start_time,
      end_time,
      requester_name,
      requester_company,
      requester_email,
      requester_phone,
      request_id
    } = body || {};

    // --- Validate input ---
    if (!holding_id || !reservation_date || !start_time || !end_time) {
      return Response.json({ error: 'Missing required fields (holding_id, reservation_date, start_time, end_time).' }, { status: 400 });
    }
    if (!TIME_RE.test(start_time) || !TIME_RE.test(end_time)) {
      return Response.json({ error: 'Times must be in 24-hour HH:MM format.' }, { status: 400 });
    }
    if (start_time >= end_time) {
      return Response.json({ error: 'End time must be after start time.' }, { status: 400 });
    }
    const dateObj = new Date(reservation_date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      return Response.json({ error: 'Invalid reservation date.' }, { status: 400 });
    }

    const user_name = (requester_name || '').trim();
    const reqCompany = (requester_company || '').trim();
    const reqEmail = (requester_email || '').trim();
    const reqPhone = (requester_phone || '').trim();
    if (!user_name) {
      return Response.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (!reqCompany) {
      return Response.json({ error: 'Please enter your company name.' }, { status: 400 });
    }
    if (!reqEmail || !isValidEmail(reqEmail)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // --- Email verification (OTP) check ---
    // The requester must have verified control of this email via the bookingOtp
    // function (a verified EmailOtp record created within the last 15 minutes).
    const otpRecords = await base44.asServiceRole.entities.EmailOtp.filter({ email: reqEmail.toLowerCase() });
    const nowMs = Date.now();
    const emailVerified = otpRecords.some(
      (r) => r.verified && nowMs - new Date(r.created_date).getTime() < 15 * 60 * 1000
    );
    if (!emailVerified) {
      return Response.json({ error: 'Please verify your email with the OTP code before submitting your request.' }, { status: 403 });
    }

    // --- Look up the holding (service role, no authenticated user) ---
    let holding;
    try {
      holding = await base44.asServiceRole.entities.Holding.get(holding_id);
    } catch {
      return Response.json({ error: 'Billboard not found.' }, { status: 404 });
    }
    const company_id = holding.company_id;
    const company_name = holding.company_name || '';
    const billboard_name = holding.name;
    if (!company_id) {
      return Response.json({ error: 'This billboard is not linked to a company.' }, { status: 400 });
    }

    // --- Overlap check (service role) ---
    const existing = await base44.asServiceRole.entities.Reservation.filter({
      holding_id,
      reservation_date
    });
    const blocking = existing.filter((r) => r && (r.status === 'pending' || r.status === 'confirmed'));
    const conflict = blocking.some((r) => start_time < r.end_time && end_time > r.start_time);
    if (conflict) {
      return Response.json({
        error: 'This time slot is already reserved (or awaiting approval) for the selected billboard and date.'
      }, { status: 409 });
    }

    // --- Create the reservation (Pending) — requester identifies themselves ---
    const reservation = await base44.asServiceRole.entities.Reservation.create({
      holding_id,
      billboard_name,
      reservation_date,
      start_time,
      end_time,
      company_id,
      company_name,
      user_id: 'public',
      user_name,
      requester_company: reqCompany,
      requester_email: reqEmail,
      requester_phone: reqPhone,
      request_id: request_id || '',
      source: 'public_link',
      status: 'pending',
      verified: true
    });

    // --- Audit trail: one "created" entry per booking request ---
    // For grouped (multi-day) requests sharing a request_id, only the first
    // reservation records the audit so the whole booking has a single trail.
    let shouldWriteAudit = true;
    if (request_id) {
      const prior = await base44.asServiceRole.entities.Reservation.filter({ request_id });
      shouldWriteAudit = prior.length === 0;
    }
    if (shouldWriteAudit) {
      await writeAudit(base44, {
        reservation_id: reservation.id,
        action: 'created',
        admin_user_id: 'public',
        admin_name: `${user_name} (${reqCompany})`,
        previous_status: '',
        new_status: 'pending',
        reason: ''
      });
    }

    // --- Notification email to the company admin ---
    const dateLabel = formatDateLabel(reservation_date);
    const { emailSent, emailError } = await sendReservationEmail(base44, {
      subject: `Public Reservation Request (Pending Approval) — ${billboard_name} — ${dateLabel} ${start_time}-${end_time}`,
      lines: [
        'A new billboard reservation request has been submitted via the public booking link and is AWAITING ADMIN APPROVAL.',
        'This is NOT a confirmed reservation yet.',
        '',
        `Status: Pending`,
        `Owning Company: ${company_name}`,
        `Billboard Name: ${billboard_name}`,
        `Date Requested: ${dateLabel}`,
        `Start Time: ${start_time}`,
        `End Time: ${end_time}`,
        `Requester's Name: ${user_name}`,
        `Requester's Company: ${reqCompany}`,
        `Requester's Email: ${reqEmail}`,
        `Requester's Phone: ${reqPhone || '—'}`,
        '',
        `Reservation ID: ${reservation.id}`
      ]
    });

    // --- Confirmation email to the requester ---
    const requesterEmail = await sendEmailTo(
      base44,
      reqEmail,
      `Your booking request was received — ${billboard_name} — ${dateLabel} ${start_time}-${end_time}`,
      [
        `Hi ${user_name},`,
        '',
        `We have received your billboard booking request and it is now AWAITING APPROVAL.`,
        'You will receive another email once an administrator confirms or rejects it.',
        '',
        ...bookingDetailLines({
          status: 'Pending',
          billboard_name,
          company_name,
          targets: [reservation]
        })
      ]
    );

    return Response.json({
      success: true,
      reservation,
      emailSent,
      emailError,
      requesterEmailSent: requesterEmail.emailSent,
      requesterEmailError: requesterEmail.emailError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}