import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendReservationEmail, sendEmailTo, isValidEmail, writeAudit, formatDateLabel, bookingDetailLines } from '../../shared/reservationEmail.ts';

// Approve, reject, or cancel a reservation (or a whole booking request group).
//  - Pass `reservation_id` to act on a single reservation.
//  - Pass `request_id` to act on every reservation sharing that request id
//    (multi-day / multi-hour requests submitted together appear as one request).
//  - approve/reject: only on pending reservations.
//  - cancel: only on confirmed reservations.
// Allowed for: a global admin, OR a company_admin who owns the holding's company.
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

    const { reservation_id, request_id, action, rejection_reason } = body || {};
    if (!reservation_id && !request_id) {
      return Response.json({ error: 'Missing reservation_id or request_id.' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject' && action !== 'cancel') {
      return Response.json({ error: 'Action must be "approve", "reject", or "cancel".' }, { status: 400 });
    }

    // --- Resolve the target set: a single reservation or a group by request_id ---
    let targets = [];
    if (request_id) {
      targets = await base44.asServiceRole.entities.Reservation.filter({ request_id });
      targets = targets.filter((r) => r && r.request_id === request_id);
    }
    if (!targets.length && reservation_id) {
      try {
        const one = await base44.asServiceRole.entities.Reservation.get(reservation_id);
        targets = [one];
      } catch {
        return Response.json({ error: 'Reservation not found.' }, { status: 404 });
      }
    }
    if (!targets.length) {
      return Response.json({ error: 'No reservations found for this request.' }, { status: 404 });
    }

    const wantedStatus = action === 'cancel' ? 'confirmed' : 'pending';
    const wrong = targets.filter((r) => r.status !== wantedStatus);
    if (wrong.length) {
      return Response.json({
        error: `Cannot ${action} — ${wrong.length} of ${targets.length} reservation(s) are not ${wantedStatus}.`
      }, { status: 409 });
    }

    // Permission: global admin, or company_admin who owns the holding's company.
    const isGlobalAdmin = user.role === 'admin';
    let isCompanyAdmin = false;
    if (user.role === 'company_admin' && user.company_id) {
      try {
        const holding = await base44.asServiceRole.entities.Holding.get(targets[0].holding_id);
        if (holding && holding.company_id && holding.company_id === user.company_id) {
          isCompanyAdmin = true;
        }
      } catch {
        isCompanyAdmin = false;
      }
    }
    if (!isGlobalAdmin && !isCompanyAdmin) {
      return Response.json({ error: 'Forbidden — only an admin for this company can confirm bookings.' }, { status: 403 });
    }

    const admin_name = user.full_name || user.email;
    const nowIso = new Date().toISOString();
    const billboard_name = targets[0].billboard_name;
    const company_name = targets[0].company_name || '';
    const source = targets[0].source;
    const requester_email = targets[0].requester_email;
    const requester_name = targets[0].user_name || '';

    // Sort by date then time for a stable, readable listing.
    targets.sort((a, b) =>
      (a.reservation_date < b.reservation_date) ? -1
      : (a.reservation_date > b.reservation_date) ? 1
      : (a.start_time < b.start_time ? -1 : 1)
    );

    const dateLines = targets.map((r) => `- ${formatDateLabel(r.reservation_date)}, ${r.start_time} – ${r.end_time}`);
    const isMulti = targets.length > 1;
    const rangeLabel = isMulti
      ? `${targets.length} day(s): ${formatDateLabel(targets[0].reservation_date)} → ${formatDateLabel(targets[targets.length - 1].reservation_date)}`
      : formatDateLabel(targets[0].reservation_date);

    if (action === 'approve') {
      // --- Final availability check across every slot in the request ---
      for (const t of targets) {
        const sameSlot = await base44.asServiceRole.entities.Reservation.filter({
          holding_id: t.holding_id,
          reservation_date: t.reservation_date
        });
        const conflict = sameSlot.some((r) =>
          r &&
          !targets.some((tt) => tt.id === r.id) &&
          r.status === 'confirmed' &&
          t.start_time < r.end_time && t.end_time > r.start_time
        );
        if (conflict) {
          return Response.json({
            error: `The slot on ${formatDateLabel(t.reservation_date)} ${t.start_time}-${t.end_time} has already been confirmed for another reservation. Cannot approve this request.`
          }, { status: 409 });
        }
      }

      const new_status = 'confirmed';
      for (const t of targets) {
        await base44.asServiceRole.entities.Reservation.update(t.id, {
          status: new_status,
          decided_by_id: user.id,
          decided_by_name: admin_name,
          decided_at: nowIso,
          rejection_reason: ''
        });
      }
      // One audit entry for the whole booking request (grouped or single).
      await writeAudit(base44, {
        reservation_id: targets[0].id,
        action: 'approved',
        admin_user_id: user.id,
        admin_name,
        previous_status: 'pending',
        new_status,
        reason: ''
      });

      const { emailSent, emailError } = await sendReservationEmail(base44, {
        subject: `Reservation CONFIRMED — ${billboard_name} — ${rangeLabel}`,
        lines: [
          'A reservation request has been CONFIRMED by an administrator.',
          '',
          `Status: Confirmed`,
          `Company Name: ${company_name}`,
          `Billboard Name: ${billboard_name}`,
          isMulti ? `Dates (${targets.length}):` : `Date:`,
          ...dateLines,
          '',
          `Approved By: ${admin_name}`,
          `Approval Date/Time: ${nowIso}`,
          '',
          `Request ID: ${request_id || targets[0].id}`
        ]
      });

      let requesterEmail = { emailSent: false, emailError: null };
      if (source === 'public_link' && isValidEmail(requester_email)) {
        requesterEmail = await sendEmailTo(
          base44,
          requester_email,
          `Your booking was CONFIRMED — ${billboard_name} — ${rangeLabel}`,
          [
            `Hi ${requester_name},`.trim(),
            '',
            'Good news — your billboard booking request has been CONFIRMED by the administrator.',
            '',
            ...bookingDetailLines({
              status: 'Approved',
              billboard_name,
              company_name,
              targets
            })
          ]
        );
      }

      return Response.json({ success: true, status: new_status, emailSent, emailError, requesterEmailSent: requesterEmail.emailSent, requesterEmailError: requesterEmail.emailError });
    }

    // --- Cancel a confirmed booking ---
    if (action === 'cancel') {
      const reason = (rejection_reason || '').trim();
      const new_status = 'cancelled';
      for (const t of targets) {
        await base44.asServiceRole.entities.Reservation.update(t.id, {
          status: new_status,
          decided_by_id: user.id,
          decided_by_name: admin_name,
          decided_at: nowIso,
          rejection_reason: reason
        });
      }
      // One audit entry for the whole booking request (grouped or single).
      await writeAudit(base44, {
        reservation_id: targets[0].id,
        action: 'cancelled',
        admin_user_id: user.id,
        admin_name,
        previous_status: 'confirmed',
        new_status,
        reason
      });

      const { emailSent, emailError } = await sendReservationEmail(base44, {
        subject: `Reservation CANCELLED — ${billboard_name} — ${rangeLabel}`,
        lines: [
          'A CONFIRMED reservation has been CANCELLED by an administrator.',
          '',
          `Status: Cancelled`,
          `Company Name: ${company_name}`,
          `Billboard Name: ${billboard_name}`,
          isMulti ? `Dates (${targets.length}):` : `Date:`,
          ...dateLines,
          `Cancelled By: ${admin_name}`,
          ...(reason ? ['', `Cancellation Reason: ${reason}`] : []),
          '',
          `Request ID: ${request_id || targets[0].id}`
        ]
      });

      let requesterEmail = { emailSent: false, emailError: null };
      if (source === 'public_link' && isValidEmail(requester_email)) {
        requesterEmail = await sendEmailTo(
          base44,
          requester_email,
          `Your booking was cancelled — ${billboard_name} — ${rangeLabel}`,
          [
            `Hi ${requester_name},`.trim(),
            '',
            'Your confirmed billboard booking has been CANCELLED by the administrator.',
            '',
            `Status: Cancelled`,
            `Billboard Name: ${billboard_name}`,
            `Company: ${company_name}`,
            isMulti ? `Dates (${targets.length}):` : `Date:`,
            ...dateLines,
            `Cancelled By: ${admin_name}`,
            ...(reason ? ['', 'Message from the administrator:', '', reason.toUpperCase()] : []),
            '',
            `Request ID: ${request_id || targets[0].id}`
          ]
        );
      }

      return Response.json({ success: true, status: new_status, emailSent, emailError, requesterEmailSent: requesterEmail.emailSent, requesterEmailError: requesterEmail.emailError });
    }

    // --- Reject ---
    const reason = (rejection_reason || '').trim();
    const new_status = 'rejected';
    for (const t of targets) {
      await base44.asServiceRole.entities.Reservation.update(t.id, {
        status: new_status,
        decided_by_id: user.id,
        decided_by_name: admin_name,
        decided_at: nowIso,
        rejection_reason: reason
      });
    }
    // One audit entry for the whole booking request (grouped or single).
    await writeAudit(base44, {
      reservation_id: targets[0].id,
      action: 'rejected',
      admin_user_id: user.id,
      admin_name,
      previous_status: 'pending',
      new_status,
      reason
    });

    const { emailSent, emailError } = await sendReservationEmail(base44, {
      subject: `Reservation REJECTED — ${billboard_name} — ${rangeLabel}`,
      lines: [
        'A reservation request has been REJECTED by an administrator.',
        '',
        `Status: Rejected`,
        `Company Name: ${company_name}`,
        `Billboard Name: ${billboard_name}`,
        isMulti ? `Dates (${targets.length}):` : `Date:`,
        ...dateLines,
        `Rejected By: ${admin_name}`,
        ...(reason ? ['', `Rejection Reason: ${reason}`] : []),
        '',
        `Request ID: ${request_id || targets[0].id}`
      ]
    });

    let requesterEmail = { emailSent: false, emailError: null };
    if (source === 'public_link' && isValidEmail(requester_email)) {
      requesterEmail = await sendEmailTo(
        base44,
        requester_email,
        `Your booking was declined — ${billboard_name} — ${rangeLabel}`,
        [
          `Hi ${requester_name},`.trim(),
          '',
          'Your billboard booking request has been DECLINED by the administrator.',
          ...(reason ? ['', `Reason: ${reason}`] : []),
          '',
          ...bookingDetailLines({
            status: 'Rejected',
            billboard_name,
            company_name,
            targets
          })
        ]
      );
    }

    return Response.json({ success: true, status: new_status, emailSent, emailError, requesterEmailSent: requesterEmail.emailSent, requesterEmailError: requesterEmail.emailError });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}