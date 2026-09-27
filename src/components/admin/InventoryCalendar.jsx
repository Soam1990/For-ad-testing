import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, X, Download, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { exportReservations } from "@/lib/exportReservations";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  parseISO,
} from "date-fns";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLOR = {
  pending: "bg-amber-500/80 text-white",
  confirmed: "bg-red-500/80 text-white",
  rejected: "bg-zinc-600/70 text-zinc-200 line-through",
  cancelled: "bg-zinc-600/70 text-zinc-200 line-through",
};

const statusChip = (s) => STATUS_COLOR[s] || "bg-zinc-600/70 text-zinc-200";

const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function InventoryCalendar() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin";
  const userCompanyId = user?.company_id || "";
  const [month, setMonth] = useState(new Date());
  const [holdings, setHoldings] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [hs, rs, bks] = await Promise.all([
        base44.entities.Holding.list("-created_date", 500),
        base44.entities.Reservation.list("-created_date", 500),
        base44.entities.Booking.list("-created_date", 500),
      ]);
      setHoldings(hs);
      setReservations(rs);
      setBookings(bks);
    } catch (e) {
      setError(e?.message || "Failed to load calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const holdingName = (id) => {
    const h = holdings.find((x) => x.id === id);
    return h ? `${h.site_code || ""} ${h.name}`.trim() : "Unknown holding";
  };

  // Expand Booking date-range records into per-day synthetic reservation entries
  // so admin self-bookings appear on the calendar alongside client reservations.
  // Bookings have no company field / RLS, so for a company admin we only keep
  // bookings whose holding belongs to their own company; bookings tied to a
  // holding that no longer exists are dropped (they would render as "Unknown").
  const scopedHoldingIds = useMemo(() => {
    if (isGlobalAdmin) return null;
    const s = new Set();
    holdings.forEach((h) => {
      if (h.company_id && h.company_id === userCompanyId) s.add(h.id);
    });
    return s;
  }, [holdings, isGlobalAdmin, userCompanyId]);

  const bookingEntries = useMemo(() => {
    const out = [];
    bookings.forEach((b) => {
      if (!b.start_date || !b.end_date || !b.holding_id) return;
      const holding = holdings.find((x) => x.id === b.holding_id);
      if (!holding) return; // holding deleted — skip to avoid "Unknown holding"
      if (scopedHoldingIds && !scopedHoldingIds.has(b.holding_id)) return; // not this company's holding
      let start, end;
      try {
        start = parseISO(b.start_date);
        end = parseISO(b.end_date);
      } catch {
        return;
      }
      if (end < start) return;
      eachDayOfInterval({ start, end }).forEach((d) => {
        out.push({
          id: `${b.id}-${format(d, "yyyy-MM-dd")}`,
          holding_id: b.holding_id,
          reservation_date: format(d, "yyyy-MM-dd"),
          start_time: "Full",
          end_time: "Day",
          status: b.status || "confirmed",
          user_name: b.client_name || "",
          source: "portal",
          _isBooking: true,
        });
      });
    });
    return out;
  }, [bookings, holdings, scopedHoldingIds]);

  const allEntries = useMemo(
    () =>
      [...reservations, ...bookingEntries].filter(
        (r) => r.status === "confirmed"
      ),
    [reservations, bookingEntries]
  );

  const filteredReservations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter((r) => {
      const h = holdings.find((x) => x.id === r.holding_id);
      const hay = [h?.site_code, h?.name, h?.city, h?.address, r.user_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allEntries, holdings, query]);

  const byDay = useMemo(() => {
    const map = {};
    filteredReservations.forEach((r) => {
      if (!r.reservation_date) return;
      const key = r.reservation_date;
      (map[key] = map[key] || []).push(r);
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
    );
    return map;
  }, [filteredReservations]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month]
  );

  const prevMonth = () =>
    setMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    setMonth(new Date());
    setSelectedDay(new Date());
  };

  const dayReservations = selectedDay
    ? byDay[format(selectedDay, "yyyy-MM-dd")] || []
    : [];

  const monthCounts = useMemo(() => {
    let confirmed = 0;
    filteredReservations.forEach((r) => {
      if (!r.reservation_date) return;
      try {
        const d = parseISO(r.reservation_date);
        if (isSameMonth(d, month) && r.status === "confirmed") confirmed++;
      } catch {}
    });
    return { confirmed };
  }, [filteredReservations, month]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary shrink-0" />
            <h2 className="font-display font-semibold text-base sm:text-lg">Inventory Calendar</h2>
          </div>
          <div className="text-sm font-medium font-display order-3 sm:order-none w-full sm:w-auto sm:ml-3">
            {format(month, "MMMM yyyy")}
          </div>
          <div className="relative w-full sm:w-56 order-4 sm:order-none">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or location"
              className="h-8 pl-8 bg-background border-border text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextMonth}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={goToday}
              className="ml-1 h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-secondary"
            >
              Today
            </button>
            <button
              onClick={() =>
                exportReservations(
                  `calendar-${format(month, "yyyy-MM")}`,
                  reservations,
                  holdings
                )
              }
              disabled={loading || reservations.length === 0}
              className="ml-1 h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-secondary inline-flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
              title="Export this calendar to CSV"
            >
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80" /> Confirmed
            <span className="font-medium text-foreground">{monthCounts.confirmed}</span>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="py-1.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const inMonth = isSameMonth(day, month);
                const key = format(day, "yyyy-MM-dd");
                const dayRes = byDay[key] || [];
                const today = isSameDay(day, new Date());
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    className={`relative min-h-[84px] border-b border-r border-border p-1.5 text-left align-top transition ${
                      !inMonth
                        ? "bg-background/40 text-muted-foreground/40"
                        : "bg-card hover:bg-secondary/40"
                    } ${isSelected ? "ring-1 ring-inset ring-primary/60 bg-primary/10" : ""}`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        today ? "bg-primary text-primary-foreground font-semibold" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-white text-xs font-semibold leading-none ${dayRes.length === 0 ? "bg-emerald-500/80" : "bg-red-500/80"}`}>
                        {dayRes.length}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-base">
              {format(selectedDay, "EEEE, MMMM d")}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>
          {dayReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reservations for this day.
            </p>
          ) : (
            <div className="space-y-2">
              {dayReservations.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2"
                >
                  <span className={`h-2.5 w-2.5 rounded-sm shrink-0 ${statusChip(r.status).split(" ")[0]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {holdingName(r.holding_id)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.start_time} – {r.end_time}
                      {r.user_name ? ` · ${r.user_name}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}