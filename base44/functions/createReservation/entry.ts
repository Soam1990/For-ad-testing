import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendReservationEmail, writeAudit, formatDateLabel } from '../../shared/reservationEmail.ts';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
      request_id,
      client_name,
      client_company,
      client_email,
      client_phone
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

    // --- Company info from the authenticated user (never hardcoded) ---
    const company_name = user.company_name;
    const company_id = user.company_id || user.id;
    if (!company_name) {
      return Response.json({ error: 'No company is associated with your account. Please update your profile.' }, { status: 400 });
    }
    // Admin manual booking can be made on behalf of a client. Capture the
    // client details (similar to the public booking page) when provided.
    const clientName = (client_name || '').trim();
    const clientCompany = (client_company || '').trim();
    const clientEmail = (client_email || '').trim();
    const clientPhone = (client_phone || '').trim();
    const user_name = clientName || user.full_name || user.email;

    // --- Look up the billboard (do not trust a client-supplied name) ---
    let holding;
    try {
      holding = await base44.entities.Holding.get(holding_id);
    } catch {
      return Response.json({ error: 'Billboard not found.' }, { status: 404 });
    }
    const billboard_name = holding.name;

    // --- Overlap check across ALL companies (service role) ---
    // Both pending and confirmed reservations block a conflicting new request.
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

    // --- Create the reservation with status Pending (NOT confirmed) ---
    const reservation = await base44.entities.Reservation.create({
      holding_id,
      billboard_name,
      reservation_date,
      start_time,
      end_time,
      company_id,
      company_name,
      user_id: user.id,
      user_name,
      request_id: request_id || '',
      requester_company: clientCompany,
      requester_email: clientEmail,
      requester_phone: clientPhone,
      status: 'pending'
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
        admin_user_id: user.id,
        admin_name: user_name,
        previous_status: '',
        new_status: 'pending',
        reason: ''
      });
    }

    // --- Notification email: request awaiting admin approval ---
    const dateLabel = formatDateLabel(reservation_date);
    const { emailSent, emailError } = await sendReservationEmail(base44, {
      subject: `Reservation Request (Pending Approval) — ${billboard_name} — ${dateLabel} ${start_time}-${end_time}`,
      lines: [
        'A new billboard reservation request has been submitted and is AWAITING ADMIN APPROVAL.',
        'This is NOT a confirmed reservation yet.',
        '',
        `Status: Pending`,
        `Company Name: ${company_name}`,
        `Billboard Name: ${billboard_name}`,
        `Date Requested: ${dateLabel}`,
        `Start Time: ${start_time}`,
        `End Time: ${end_time}`,
        `Submitted By: ${user.full_name || user.email}`,
        ...(clientName ? [`Client Name: ${clientName}`] : []),
        ...(clientCompany ? [`Client Company: ${clientCompany}`] : []),
        ...(clientEmail ? [`Client Email: ${clientEmail}`] : []),
        ...(clientPhone ? [`Client Phone: ${clientPhone}`] : []),
        '',
        `Reservation ID: ${reservation.id}`
      ]
    });

    return Response.json({
      success: true,
      reservation,
      emailSent,
      emailError
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}