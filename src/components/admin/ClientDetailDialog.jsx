import React from "react";
import { format, parseISO } from "date-fns";
import { Building2, Phone, Mail, MapPin, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusBadge = (s) => {
  const map = {
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    rejected: "bg-red-500/15 text-red-400 border-red-500/40",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/40",
  };
  return map[s] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/40";
};

export default function ClientDetailDialog({ row, onClose, audits = [] }) {
  if (!row) return null;
  const g = row.group;
  const resAudits = g.items.flatMap((it) =>
    audits.filter((a) => a.reservation_id === it.id)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display">Booking details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto scrollbar-thin pr-1">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">
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

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <Building2 size={12} /> {row.company || "—"}
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Phone size={12} /> {row.phone || "—"}
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <Mail size={12} /> {row.email || "—"}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={12} />{" "}
              {row.source === "public_link" ? "Public link" : "Portal"}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Billboard
            </div>
            <div>{row.billboard || "—"}</div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Date(s) & Time(s)
            </div>
            <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs font-mono space-y-0.5">
              {g.items.map((it, i) => (
                <div key={i}>
                  {it.reservation_date} · {it.start_time}–{it.end_time}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Requested: </span>
              {row.requested || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Decided: </span>
              {row.decided || "—"}
            </div>
          </div>

          {row.decidedByName && (
            <div className="text-xs text-muted-foreground">
              Decided by {row.decidedByName}
            </div>
          )}
          {row.reason && (
            <div className="text-xs text-red-400">Reason: {row.reason}</div>
          )}

          {resAudits.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <History size={12} /> Audit trail
              </div>
              <ul className="space-y-1 text-xs">
                {resAudits.map((a, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className="font-mono text-muted-foreground">
                      {a.action_date
                        ? format(parseISO(a.action_date), "dd MMM yy HH:mm")
                        : "—"}
                    </span>
                    <span className="capitalize">{a.action}</span>
                    <span className="text-muted-foreground">
                      {a.previous_status || "—"} → {a.new_status}
                    </span>
                    <span className="text-muted-foreground">
                      by {a.admin_name || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}