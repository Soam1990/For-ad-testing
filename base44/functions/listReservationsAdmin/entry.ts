import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Returns reservations (and their audit trail) that the caller is allowed to manage:
// - global admin: everything across all companies
// - company_admin: only reservations on holdings owned by their company
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isGlobalAdmin = user.role === 'admin';
    const isCompanyAdmin = user.role === 'company_admin';
    if (!isGlobalAdmin && !isCompanyAdmin) {
      return Response.json({ error: 'Forbidden — admin role required.' }, { status: 403 });
    }

    let reservations = [];
    let audits = [];

    if (isGlobalAdmin) {
      reservations = await base44.asServiceRole.entities.Reservation.list('-created_date', 500);
      try {
        audits = await base44.asServiceRole.entities.ReservationAudit.list('-action_date', 1000);
      } catch (e) {
        console.error('Failed to load audit trail:', (e && e.message) ? e.message : String(e));
      }
      return Response.json({ reservations, audits });
    }

    // company_admin: scope to their company's holdings
    const holdings = await base44.asServiceRole.entities.Holding.filter({
      company_id: user.company_id
    });
    const ownedIds = new Set(holdings.map((h) => h.id));

    const all = await base44.asServiceRole.entities.Reservation.list('-created_date', 500);
    reservations = all.filter((r) => r && ownedIds.has(r.holding_id));

    const resIds = new Set(reservations.map((r) => r.id));
    try {
      const allAudits = await base44.asServiceRole.entities.ReservationAudit.list('-action_date', 1000);
      audits = allAudits.filter((a) => resIds.has(a.reservation_id));
    } catch (e) {
      console.error('Failed to load audit trail:', (e && e.message) ? e.message : String(e));
    }

    return Response.json({ reservations, audits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}