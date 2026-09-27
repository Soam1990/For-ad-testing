import React, { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Search,
  FileText,
  FileSpreadsheet,
  Loader2,
  Eye,
  Building2,
  Phone,
  CalendarDays,
  Clock,
  Lock,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportClientsPDF, exportClientsExcel } from "@/lib/exportClients";
import ClientDetailDialog from "@/components/admin/ClientDetailDialog";

const STATUS_LABEL = {
  confirmed: "Accepted",
  rejected: "Rejected",
  pending: "Pending",
  cancelled: "Cancelled",
};
const STATUS_ORDER = ["all", "confirmed", "rejected", "pending", "cancelled"];

const statusBadge = (s) => {
  const map = {
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    rejected: "bg-red-500/15 text-red-400 border-red-500/40",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
  };
  return map[s] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/40";
};

const splitName = (full) => {
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

// Group reservations by request_id so a multi-day/hour submission is one row.
const buildGroups = (reservations) => {
  const m = new Map();
  reservations.forEach((r) => {
    const key = r.request_id || r.id;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  });
  return Array.from(m.entries()).map(([key, items]) => {
    items.sort((a, b) =>
      a.reservation_date < b.reservation_date
        ? -1
        : a.reservation_date > b.reservation_date
        ? 1
        : 0
    );
    const first = items[0];
    return { key, items, reservation: first, isGroup: items.length > 1, status: first.status };
  });
};

export default function Clients() {
  const { user, isLoadingAuth } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "company_admin";
  const [reservations, setReservations] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("listReservationsAdmin", {});
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      setReservations(data.reservations || []);
      setAudits(data.audits || []);
    } catch (e) {
      setError(
        e?.response?.data?.error || e.message || "Failed to load client requests."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);

  const groups = useMemo(() => buildGroups(reservations), [reservations]);

  const rows = useMemo(
    () =>
      groups.map((g) => {
        const r = g.reservation;
        const { firstName, lastName } = splitName(r.user_name);
        return {
          key: g.key,
          group: g,
          firstName,
          lastName,
          company: r.requester_company || r.company_name || "",
          phone: r.requester_phone || "",
          email: r.requester_email || "",
          billboard: r.billboard_name || "",
          source: r.source || "portal",
          status: r.status,
          statusLabel: STATUS_LABEL[r.status] || r.status,
          requested: r.created_date
            ? format(parseISO(r.created_date), "dd MMM yyyy HH:mm")
            : "",
          requestedISO: r.created_date || "",
          decided: r.decided_at
            ? format(parseISO(r.decided_at), "dd MMM yyyy HH:mm")
            : "",
          decidedByName: r.decided_by_name || "",
          reason: r.rejection_reason || "",
        };
      }),
    [groups]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (row.requestedISO) {
        const d = row.requestedISO.slice(0, 10);
        if (from && d < from) return false;
        if (to && d > to) return false;
      } else if (from || to) {
        return false;
      }
      if (q) {
        const hay = [
          row.firstName,
          row.lastName,
          row.company,
          row.phone,
          row.email,
          row.billboard,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, from, to, search]);

  const countFor = (s) =>
    s === "all" ? rows.length : rows.filter((r) => r.status === s).length;

  const rangeLabel = `${from || "Any"} → ${to || "Any"}`;
  const exportRows = filtered.map((r) => ({
    firstName: r.firstName,
    lastName: r.lastName,
    company: r.company,
    phone: r.phone,
    email: r.email,
    status: r.statusLabel,
    requested: r.requested,
    decided: r.decided,
  }));

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-500/15 flex items-center justify-center">
            <Lock size={26} className="text-red-400" />
          </div>
          <h1 className="font-display text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Only admins can view client requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Building2 size={18} className="text-primary" />
        <h1 className="font-display font-bold text-lg sm:text-xl">Clients</h1>
        <span className="text-xs text-muted-foreground">
          {filtered.length} request(s)
        </span>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 flex-1">
            <Search size={15} className="text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, phone, email…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-9 px-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-background h-9 w-auto"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="bg-background h-9 w-auto"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium border ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]} ({countFor(s)})
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportClientsPDF(exportRows, { range: rangeLabel })}
              disabled={!filtered.length}
            >
              <FileText size={14} className="mr-1" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportClientsExcel(exportRows, { range: rangeLabel })}
              disabled={!filtered.length}
            >
              <FileSpreadsheet size={14} className="mr-1" /> Excel
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No client requests match the current filters.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {filtered.map((row) => (
              <button
                key={row.key}
                onClick={() => setDetail(row)}
                className="w-full text-left rounded-lg border border-border bg-card p-3 space-y-2 hover:border-primary/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {row.firstName} {row.lastName}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadge(
                      row.status
                    )}`}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={11} /> {row.company || "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={11} /> {row.phone || "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={11} /> Requested {row.requested || "—"}
                  </div>
                  {row.decided && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} /> Decided {row.decided}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">First Name</th>
                  <th className="text-left px-3 py-2 font-medium">Last Name</th>
                  <th className="text-left px-3 py-2 font-medium">Company</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Requested</th>
                  <th className="text-left px-3 py-2 font-medium">Decided</th>
                  <th className="text-right px-3 py-2 font-medium">View</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-border hover:bg-secondary/20 cursor-pointer"
                    onClick={() => setDetail(row)}
                  >
                    <td className="px-3 py-2">{row.firstName || "—"}</td>
                    <td className="px-3 py-2">{row.lastName || "—"}</td>
                    <td className="px-3 py-2">{row.company || "—"}</td>
                    <td className="px-3 py-2">{row.phone || "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadge(
                          row.status
                        )}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {row.requested || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {row.decided || "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Eye size={15} className="inline text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ClientDetailDialog row={detail} onClose={() => setDetail(null)} audits={audits} />
    </div>
  );
}