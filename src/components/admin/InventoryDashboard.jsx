import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  CalendarDays,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Image } from "@/components/ui/image";
import AvailabilityTimeline from "@/components/AvailabilityTimeline";
import MapSnippet from "@/components/MapSnippet";
import HoldingCalendarDialog from "@/components/HoldingCalendarDialog";
import HoldingForm from "./HoldingForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const typeGradients = {
  Billboard: "from-cyan-500/25 to-blue-700/10",
  "Digital Screen": "from-fuchsia-500/25 to-cyan-500/10",
  Transit: "from-amber-500/25 to-rose-500/10",
};

export default function InventoryDashboard({ companyId = "", companies = [] }) {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin";
  const [holdings, setHoldings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarHolding, setCalendarHolding] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [hs, bks] = await Promise.all([
        base44.entities.Holding.list("-created_date", 500),
        base44.entities.Booking.list("-created_date", 500),
      ]);
      setHoldings(hs);
      setBookings(bks);
    } catch (e) {
      setError(e?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleHoldings = companyId
    ? holdings.filter((h) => h.company_id === companyId)
    : holdings;

  const q = query.trim().toLowerCase();
  const filteredHoldings = q
    ? visibleHoldings.filter(
        (h) =>
          (h.name || "").toLowerCase().includes(q) ||
          (h.city || "").toLowerCase().includes(q)
      )
    : visibleHoldings;

  const holdingIds = useMemo(() => new Set(visibleHoldings.map((h) => h.id)), [visibleHoldings]);

  const bookingsByHolding = useMemo(() => {
    const m = {};
    bookings
      .filter((b) => holdingIds.has(b.holding_id))
      .forEach((b) => {
        (m[b.holding_id] = m[b.holding_id] || []).push(b);
      });
    return m;
  }, [bookings, holdingIds]);

  const remove = async (h) => {
    if (!window.confirm(`Delete "${h.name}"? This cannot be undone.`)) return;
    setDeleting(h.id);
    try {
      await base44.entities.Holding.delete(h.id);
      setHoldings((prev) => prev.filter((x) => x.id !== h.id));
    } catch (e) {
      alert(e?.message || "Failed to delete holding.");
    } finally {
      setDeleting(null);
    }
  };

  const onSaved = () => {
    setEditTarget(null);
    setShowForm(false);
    load();
  };

  const onBooking = async (payload) => {
    await base44.entities.Booking.create({
      holding_id: payload.holding_id,
      client_name: payload.client_name,
      start_date: payload.start_date,
      end_date: payload.end_date,
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-semibold text-lg">My Inventory</h2>
          <p className="text-xs text-muted-foreground">
            {filteredHoldings.length} of {visibleHoldings.length} holding{visibleHoldings.length === 1 ? "" : "s"} · click a row to open its calendar
          </p>
        </div>
        {visibleHoldings.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or location"
              className="h-8 pl-8 bg-background border-border text-sm"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : visibleHoldings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
          <Building2 size={28} className="mx-auto text-muted-foreground" />
          <h3 className="font-display font-semibold">No inventory yet</h3>
          <p className="text-sm text-muted-foreground">
            Add your first holding to start tracking availability.
          </p>
          <Button className="mt-2" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={15} className="mr-1" /> Add Holding
          </Button>
        </div>
      ) : filteredHoldings.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
          <Building2 size={28} className="mx-auto text-muted-foreground" />
          <h3 className="font-display font-semibold">No holdings found</h3>
          <p className="text-sm text-muted-foreground">
            No inventory matches your search. Try a different name or location.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHoldings.map((h) => {
            const gradient = typeGradients[h.type] ?? "from-cyan-500/20 to-slate-700/10";
            const available = h.status !== "booked";
            return (
              <div
                key={h.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-stretch gap-0">
                  <button
                    type="button"
                    onClick={() => setCalendarHolding(h)}
                    className="relative h-24 w-28 sm:w-32 shrink-0 overflow-hidden"
                  >
                    {h.image_url ? (
                      <Image
                        src={h.image_url}
                        alt={h.name}
                        className="h-full w-full"
                        fittingType="fill"
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalendarHolding(h)}
                    className="relative h-24 w-28 sm:w-32 shrink-0 overflow-hidden hidden sm:block"
                    title={h.address || h.city || h.name}
                  >
                    <MapSnippet holding={h} className="h-full w-full" showLabel={false} />
                  </button>

                  <div className="flex-1 min-w-0 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wider text-primary font-medium">
                            {h.site_code}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              available
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {available ? "Available" : "Booked"}
                          </span>
                        </div>
                        <div className="font-medium text-sm truncate">{h.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={12} /> {h.city}
                          <span className="mx-1">·</span>
                          {h.type}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditTarget(h)}
                          className="h-8 w-8"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(h)}
                          disabled={deleting === h.id}
                          className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                          title="Delete"
                        >
                          {deleting === h.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    </div>

                    <AvailabilityTimeline
                      bookings={bookingsByHolding[h.id] || []}
                      startDate={new Date()}
                      compact
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCalendarHolding(h)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary border-t border-border hover:bg-primary/5 transition"
                >
                  <CalendarDays size={14} />
                  Open calendar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add holding option — second */}
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition py-4 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <Plus size={16} /> Add Holding
      </button>

      {/* Calendar dialog for a holding */}
      <HoldingCalendarDialog
        open={!!calendarHolding}
        onOpenChange={(o) => !o && setCalendarHolding(null)}
        holding={calendarHolding}
        bookings={calendarHolding ? bookingsByHolding[calendarHolding.id] || [] : []}
        onBooking={onBooking}
      />

      {/* Add / Edit form */}
      <Dialog open={showForm || !!editTarget} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditTarget(null); } }}>
        <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[88vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editTarget ? "Edit holding" : "Add holding"}
            </DialogTitle>
            <DialogDescription>
              {editTarget ? "Update this inventory holding." : "Create a new inventory holding."}
            </DialogDescription>
          </DialogHeader>
          <HoldingForm
            holding={editTarget || undefined}
            onSaved={onSaved}
            user={user}
            companies={companies}
            defaultCompanyId={companyId}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}