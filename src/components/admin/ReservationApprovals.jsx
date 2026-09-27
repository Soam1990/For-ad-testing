import React, { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Check, X, History, Loader2, CalendarDays } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_FILTERS = ["pending", "confirmed", "rejected", "all"];

const statusBadge = (status) => {
  const map = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    rejected: "bg-red-500/15 text-red-400 border-red-500/40",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
  };
  return map[status] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/40";
};

// Group reservations by request_id so a multi-day / multi-hour submission
// appears as ONE request. Legacy records (no request_id) become singletons.
const buildGroups = (reservations) => {
  const m = new Map();
  reservations.forEach((r) => {
    const key = r.request_id || r.id;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  });
  return Array.from(m.entries()).map(([key, items]) => {
    items.sort((a, b) =>
      a.reservation_date < b.reservation_date ? -1
      : a.reservation_date > b.reservation_date ? 1
      : a.start_time < b.start_time ? -1 : 1
    );
    // Group status: all items share the same status (decisions apply to the
    // whole group). If they ever differ, fall back to the first item's status.
    const first = items[0];
    const sameStatus = items.every((it) => it.status === first.status);
    return {
      key,
      items,
      reservation: first,
      isGroup: items.length > 1,
      status: sameStatus ? first.status : first.status,
      hasRequestId: !!first.request_id,
    };
  });
};

export default function ReservationApprovals() {
  const [reservations, setReservations] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [busy, setBusy] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);

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
      setError(e?.response?.data?.error || e.message || "Failed to load reservations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => buildGroups(reservations), [reservations]);

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter((g) => g.items.every((it) => it.status === filter));
  }, [groups, filter]);

  const countFor = (s) =>
    s === "all" ? groups.length : groups.filter((g) => g.items.every((it) => it.status === s)).length;

  const auditsByRes = useMemo(() => {
    const m = {};
    audits.forEach((a) => {
      (m[a.reservation_id] ||= []).push(a);
    });
    return m;
  }, [audits]);

  const decidePayload = (g, action, extra = {}) => {
    if (g.hasRequestId) return { request_id: g.key, action, ...extra };
    return { reservation_id: g.items[0].id, action, ...extra };
  };

  const approve = async (g) => {
    const label = g.isGroup
      ? `${g.reservation.billboard_name} (${g.items.length} days)`
      : `${g.reservation.company_name} on ${g.reservation.reservation_date} ${g.reservation.start_time}-${g.reservation.end_time}`;
    if (!window.confirm(`Approve booking request for ${label}?`)) return;
    setBusy(g.key);
    setError("");
    try {
      const res = await base44.functions.invoke("decideReservation", decidePayload(g, "approve"));
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Approval failed.");
    } finally {
      setBusy(null);
    }
  };

  const submitReject = async () => {
    const g = rejectTarget;
    if (!g) return;
    setBusy(g.key);
    setError("");
    try {
      const res = await base44.functions.invoke(
        "decideReservation",
        decidePayload(g, "reject", { rejection_reason: rejectReason })
      );
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Rejection failed.");
    } finally {
      setBusy(null);
    }
  };

  const submitCancel = async () => {
    const g = cancelTarget;
    if (!g) return;
    setBusy(g.key);
    setError("");
    try {
      const res = await base44.functions.invoke(
        "decideReservation",
        decidePayload(g, "cancel", { rejection_reason: cancelReason })
      );
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Cancellation failed.");
    } finally {
      setBusy(null);
    }
  };

  const dateListLines = (g) =>
    g.items.map((it) => `${it.reservation_date} · ${it.start_time}–${it.end_time}`);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium border capitalize ${
              filter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {s} ({countFor(s)})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
      ) : filteredGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reservations in this view.</p>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {filteredGroups.map((g) => {
            const r = g.reservation;
            return (
              <div key={g.key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${statusBadge(r.status)}`}>
                      {r.status}
                    </span>
                    {g.isGroup && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-primary/40 bg-primary/15 text-primary">
                        <CalendarDays size={11} /> {g.items.length} days
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                    className="text-xs text-primary inline-flex items-center gap-1"
                  >
                    <History size={12} /> {expanded === g.key ? "Hide" : "History"}
                  </button>
                </div>
                <div className="text-sm font-medium truncate">{r.billboard_name}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="truncate">{r.company_name}</div>
                  {r.user_name && <div>{r.user_name}</div>}
                  {r.requester_company && (
                    <div className="flex items-center gap-1.5">
                      {r.requester_company}
                      {r.source === "public_link" && (
                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-[10px]">
                          public
                        </span>
                      )}
                    </div>
                  )}
                  {r.requester_email && <div className="truncate">{r.requester_email}</div>}
                  {r.requester_phone && <div>📞 {r.requester_phone}</div>}
                  <div className="font-mono space-y-0.5 pt-1">
                    {g.isGroup ? (
                      <>
                        <div className="text-muted-foreground/80 text-[11px]">
                          {dateListLines(g).length} date(s) in this request:
                        </div>
                        {dateListLines(g).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </>
                    ) : (
                      <div>{r.reservation_date} · {r.start_time}–{r.end_time}</div>
                    )}
                  </div>
                  {r.created_date && <div>Requested {format(parseISO(r.created_date), "dd MMM yy HH:mm")}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => approve(g)} disabled={busy === g.key} className="h-8 px-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                        <Check size={13} /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setRejectTarget(g); setRejectReason(""); }} disabled={busy === g.key} className="h-8 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                        <X size={13} /> Reject
                      </Button>
                    </>
                  )}
                  {r.status === "confirmed" && (
                    <Button size="sm" variant="outline" onClick={() => { setCancelTarget(g); setCancelReason(""); }} disabled={busy === g.key} className="h-8 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10">
                      <X size={13} /> Cancel
                    </Button>
                  )}
                  {busy === g.key && <Loader2 size={13} className="animate-spin" />}
                </div>
                {expanded === g.key && (
                  <div className="pt-2 border-t border-border">
                    <HistoryBlock g={g} audits={g.items.flatMap((it) => auditsByRes[it.id] || [])} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Company</th>
                <th className="text-left px-3 py-2 font-medium">Requester</th>
                <th className="text-left px-3 py-2 font-medium">Billboard</th>
                <th className="text-left px-3 py-2 font-medium">Dates / Times</th>
                <th className="text-left px-3 py-2 font-medium">Requested</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => {
                const r = g.reservation;
                return (
                  <React.Fragment key={g.key}>
                    <tr className="border-t border-border hover:bg-secondary/20 align-top">
                      <td className="px-3 py-2">{r.company_name}</td>
                      <td className="px-3 py-2">
                        <div className="text-muted-foreground">{r.user_name || "—"}</div>
                        <div className="text-[11px] text-muted-foreground/80">
                          {r.requester_company || ""}
                          {r.source === "public_link" && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                              public link
                            </span>
                          )}
                          {r.requester_email && <div className="truncate">{r.requester_email}</div>}
                          {r.requester_phone && <div>📞 {r.requester_phone}</div>}
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.billboard_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {g.isGroup ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border border-primary/40 bg-primary/15 text-primary">
                              <CalendarDays size={10} /> {g.items.length} days
                            </div>
                            <div className="font-mono text-xs space-y-0.5">
                              {dateListLines(g).map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-xs whitespace-nowrap">
                            {r.reservation_date} · {r.start_time}–{r.end_time}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {r.created_date
                          ? format(parseISO(r.created_date), "dd MMM yy HH:mm")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${statusBadge(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {r.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approve(g)}
                                disabled={busy === g.key}
                                className="h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                <Check size={13} /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectTarget(g);
                                  setRejectReason("");
                                }}
                                disabled={busy === g.key}
                                className="h-7 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
                              >
                                <X size={13} /> Reject
                              </Button>
                            </>
                          )}
                          {r.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCancelTarget(g);
                                setCancelReason("");
                              }}
                              disabled={busy === g.key}
                              className="h-7 px-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
                            >
                              <X size={13} /> Cancel Booking
                            </Button>
                          )}
                          <button
                            onClick={() => setExpanded(expanded === g.key ? null : g.key)}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <History size={12} /> {expanded === g.key ? "Hide" : "History"}
                          </button>
                          {busy === g.key && <Loader2 size={13} className="animate-spin" />}
                        </div>
                      </td>
                    </tr>
                    {expanded === g.key && (
                      <tr className="border-t border-border bg-secondary/10">
                        <td colSpan={7} className="px-3 py-3">
                          <HistoryBlock g={g} audits={g.items.flatMap((it) => auditsByRes[it.id] || [])} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Reject dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <X size={18} className="text-red-400" /> Reject booking request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {rejectTarget?.reservation?.company_name} · {rejectTarget?.reservation?.billboard_name}
              {rejectTarget?.isGroup ? ` · ${rejectTarget?.items?.length} day(s)` : ` · ${rejectTarget?.reservation?.reservation_date} ${rejectTarget?.reservation?.start_time}–${rejectTarget?.reservation?.end_time}`}
            </p>
            {rejectTarget?.isGroup && (
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs font-mono space-y-0.5">
                {rejectTarget && dateListLines(rejectTarget).map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}
            <label className="space-y-1 block">
              <span className="text-xs text-muted-foreground">
                Rejection reason (optional — included in the email)
              </span>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="bg-background"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={submitReject}
              disabled={busy === rejectTarget?.key}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {busy === rejectTarget?.key ? "Rejecting…" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmed booking dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <X size={18} className="text-red-400" /> Cancel confirmed booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {cancelTarget?.reservation?.company_name} · {cancelTarget?.reservation?.billboard_name}
              {cancelTarget?.isGroup ? ` · ${cancelTarget?.items?.length} day(s)` : ` · ${cancelTarget?.reservation?.reservation_date} ${cancelTarget?.reservation?.start_time}–${cancelTarget?.reservation?.end_time}`}
            </p>
            {cancelTarget?.isGroup && (
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs font-mono space-y-0.5">
                {cancelTarget && dateListLines(cancelTarget).map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This will cancel the confirmed reservation and email the requester about it.
            </p>
            <label className="space-y-1 block">
              <span className="text-xs text-muted-foreground">
                Reason (optional — included in the email)
              </span>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="bg-background"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
            >
              Close
            </Button>
            <Button
              onClick={submitCancel}
              disabled={busy === cancelTarget?.key}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {busy === cancelTarget?.key ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryBlock({ g, audits }) {
  const r = g.reservation;
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        Decided by: <span className="text-foreground">{r.decided_by_name || "—"}</span>
        {r.decided_at ? ` · ${format(parseISO(r.decided_at), "dd MMM yy HH:mm")}` : ""}
        {r.rejection_reason ? ` · Reason: ${r.rejection_reason}` : ""}
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Audit Trail</div>
      {audits.length === 0 ? (
        <p className="text-xs text-muted-foreground">No audit entries.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {audits.map((a, i) => (
            <li key={i} className="flex flex-wrap gap-2">
              <span className="font-mono text-muted-foreground">
                {a.action_date ? format(parseISO(a.action_date), "dd MMM yy HH:mm") : "—"}
              </span>
              <span className="capitalize">{a.action}</span>
              <span className="text-muted-foreground">
                {a.previous_status || "—"} → {a.new_status}
              </span>
              <span className="text-muted-foreground">by {a.admin_name || "—"}</span>
              {a.reason ? <span className="text-red-400">· {a.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}