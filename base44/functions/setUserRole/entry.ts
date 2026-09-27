import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const VALID_ROLES = ['admin', 'company_admin', 'user'];

// Global-admin only: set a user's role (admin / company_admin / user) and
// optionally assign them to a company.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — global admin role required.' }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { user_id, role, company_id, company_name } = body || {};
    if (!user_id) return Response.json({ error: 'Missing user_id.' }, { status: 400 });
    if (!VALID_ROLES.includes(role)) {
      return Response.json({ error: 'Role must be "admin", "company_admin" or "user".' }, { status: 400 });
    }
    if (user_id === user.id) {
      return Response.json({ error: 'You cannot change your own role.' }, { status: 400 });
    }
    if (role === 'company_admin' && !company_id) {
      return Response.json({ error: 'A company_admin must be assigned to a company.' }, { status: 400 });
    }

    const update = { role };
    if (company_id !== undefined) update.company_id = company_id || '';
    if (company_name !== undefined) update.company_name = company_name || '';

    try {
      await base44.asServiceRole.entities.User.update(user_id, update);
    } catch (e) {
      return Response.json({ error: 'Failed to update user. ' + ((e && e.message) ? e.message : String(e)) }, { status: 500 });
    }

    return Response.json({ success: true, user_id, role, company_id: update.company_id, company_name: update.company_name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}