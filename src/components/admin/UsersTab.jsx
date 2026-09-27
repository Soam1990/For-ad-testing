import React, { useEffect, useState } from "react";
import { Loader2, Shield, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

const ROLE_OPTS = [
  { value: "user", label: "User" },
  { value: "company_admin", label: "Company admin" },
  { value: "admin", label: "Global admin" },
];

export default function UsersTab({ companyId = "" }) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [us, comps] = await Promise.all([
        base44.entities.User.list("-created_date", 200),
        base44.entities.Company.list("-created_date", 100),
      ]);
      setUsers(us);
      setCompanies(comps);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleUsers = companyId
    ? users.filter((u) => u.company_id === companyId)
    : users;

  const apply = async (u, role, companyId) => {
    if (u.id === me?.id) return;
    setBusy(u.id);
    setError("");
    try {
      const payload = { user_id: u.id, role };
      const comp = companies.find((c) => c.id === companyId);
      if (role === "company_admin") {
        if (!comp) {
          setError("A company admin must be assigned to a company.");
          setBusy(null);
          return;
        }
        payload.company_id = comp.id;
        payload.company_name = comp.name;
      } else {
        payload.company_id = comp ? comp.id : "";
        payload.company_name = comp ? comp.name : "";
      }
      const res = await base44.functions.invoke("setUserRole", payload);
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to update user.");
    } finally {
      setBusy(null);
    }
  };

  const selectCls =
    "bg-background border border-border rounded px-2 py-1 text-xs h-8 max-w-[150px]";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assign roles and companies. <span className="text-primary">Global admin</span> has
        full access; <span className="text-primary">Company admin</span> manages one
        company's inventory and confirms that company's bookings. You cannot edit your own
        row.
      </p>
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {loading ? (
        <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
      ) : visibleUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users for this company.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Company</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => {
                const isMe = u.id === me?.id;
                const isAdmin = u.role === "admin";
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-3 py-2">
                      {u.full_name || "—"}{" "}
                      {isMe && <span className="text-[10px] text-primary">(you)</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{u.email || "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={u.company_id || ""}
                        disabled={isMe || busy === u.id}
                        onChange={(e) => apply(u, u.role, e.target.value)}
                        className={selectCls}
                      >
                        <option value="">— None —</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
                          isAdmin
                            ? "bg-primary/15 text-primary border-primary/40"
                            : u.role === "company_admin"
                            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}
                      >
                        {isAdmin ? <ShieldCheck size={11} /> : <Shield size={11} />} {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isMe ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : busy === u.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => apply(u, e.target.value, u.company_id)}
                          className={selectCls}
                        >
                          {ROLE_OPTS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}