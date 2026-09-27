import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Public availability for a holding: returns occupied slots (date/start/end/status)
// without exposing which company booked them. Used by the shareable booking page.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let holding_id;
    try {
      const body = await req.json();
      holding_id = body?.holding_id;
    } catch {
      // fall through to query param
    }
    if (!holding_id) {
      try {
        const url = new URL(req.url);
        holding_id = url.searchParams.get('holding_id');
      } catch {}
    }
    if (!holding_id) {
      return Response.json({ error: 'Missing holding_id.' }, { status: 400 });
    }

    const all = await base44.asServiceRole.entities.Reservation.filter({ holding_id });
    const slots = all
      .filter((r) => r && (r.status === 'pending' || r.status === 'confirmed'))
      .map((r) => ({
        reservation_date: r.reservation_date,
        start_time: r.start_time,
        end_time: r.end_time,
        status: r.status,
        company_name: ''
      }));

    return Response.json({ slots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}