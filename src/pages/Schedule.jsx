import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  MapPin,
  Building2,
  Search,
  X,
  CalendarDays as CalendarDaysIcon,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  addMonths,
  startOfMonth,
  format,
  parseISO,
  isWithinInterval,
  isSameDay,
} from "date-fns";
import CalendarMonthView from "@/components/calendar/CalendarMonthView";
import { toIntervals } from "@/components/calendar/calendarHelpers";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";

export default function Schedule() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "admin";
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [holdings, setHoldings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [hs, bks, res] = await Promise.all([
        base44.entities.Holding.list("-created_date", 500),
        base44.entities.Booking.list("-created_date", 500),
        base44.entities.Reservation.list("-created_date", 500),
      ]);
      const ordered = [...hs].sort(
        (a, b) =>
          (a.site_code || "").localeCompare(b.site_code || "") ||
          (a.name || "").localeCompare(b.name || "")
      );
      setHoldings(ordered);
      setBookings(bks);
      setReservations(res);
    } catch (e) {
      setError(e?.message || "Failed to load calendars.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Merge admin self-bookings (date ranges) with confirmed client reservations
  // (single-day entries) so both show on the shared schedule calendar.
  const entriesByHolding = useMemo(() => {
    const m = {};
    bookings.forEach((b) => {
      (m[b.holding_id] = m[b.holding_id] || []).push(b);
    });
    reservations.forEach((r) => {
      if (r.status !== "confirmed") return;
      if (!r.holding_id || !r.reservation_date) return;
      (m[r.holding_id] = m[r.holding_id] || []).push({
        id: r.id,
        client_name: r.user_name || r.requester_company || "",
        start_date: r.reservation_date,
        end_date: r.reservation_date,
        status: "confirmed",
        _isReservation: true,
      });
    });
    return m;
  }, [bookings, reservations]);

  const scopedHoldings = isGlobalAdmin
    ? holdings
    : holdings.filter((h) => h.company_id === user?.company_id);

  const visibleHoldings = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scopedHoldings;
    return scopedHoldings.filter((h) =>
      [h.site_code, h.name, h.city, h.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [scopedHoldings, query]);

  const bookingsForDay = useMemo(() => {
    if (!selectedDay) return [];
    const result = [];
    visibleHoldings.forEach((h) => {
      (entriesByHolding[h.id] || []).forEach((b) => {
        if (b.status !== "confirmed") return;
        let start, end;
        try {
          start = parseISO(b.start_date);
          end = parseISO(b.end_date);
        } catch {
          return;
        }
        if (end < start) return;
        if (isWithinInterval(selectedDay, { start, end })) {
          result.push({ booking: b, holding: h });
        }
      });
    });
    return result;
  }, [selectedDay, visibleHoldings, entriesByHolding]);

  return (
    <div className="space-y-5 px-4 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CalendarDays size={20} className="text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl truncate">All Screens · Schedule</h1>
            <p className="text-xs text-muted-foreground">
              {visibleHoldings.length} screen{visibleHoldings.length === 1 ? "" : "s"} · shared month view
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-56 order-3 sm:order-none">
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
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setMonth(startOfMonth(new Date()))}
            className="ml-1 h-8 px-3 rounded-md text-xs font-medium border border-border hover:bg-secondary"
          >
            Today
          </button>
          <div className="ml-2 text-sm font-medium font-display">
            {format(month, "MMMM yyyy")}
          </div>
        </div>
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
          <h3 className="font-display font-semibold">No screens to display</h3>
          <p className="text-sm text-muted-foreground">
            Add holdings to see their calendars here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedDay && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon size={16} className="text-primary" />
                <h3 className="font-display font-semibold text-sm">
                  {format(selectedDay, "EEEE, MMMM d")} · {bookingsForDay.length} booking{bookingsForDay.length === 1 ? "" : "s"}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
                >
                  <X size={15} />
                </button>
              </div>
              {bookingsForDay.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No bookings on this day across your screens.
                </p>
              ) : (
                <div className="space-y-2">
                  {bookingsForDay.map(({ booking: b, holding: h }) => (
                    <div
                      key={b.id + h.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {h.site_code} {h.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.client_name} ·{" "}
                          {b._isReservation
                            ? format(parseISO(b.start_date), "MMM d")
                            : `${format(parseISO(b.start_date), "MMM d")} – ${format(parseISO(b.end_date), "MMM d")}`}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                        Booked
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {visibleHoldings.map((h, idx) => {
            const intervals = toIntervals(entriesByHolding[h.id] || []);
            return (
              <div
                key={h.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wider text-primary font-medium">
                        {h.site_code}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          h.status !== "booked"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {h.status !== "booked" ? "Available" : "Booked"}
                      </span>
                    </div>
                    <div className="font-medium text-sm truncate">{h.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin size={12} /> {h.city}
                      <span className="mx-1">·</span>
                      {h.type}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {intervals.length} active booking{intervals.length === 1 ? "" : "s"}
                  </span>
                </div>
                <CalendarMonthView
                  month={month}
                  intervals={intervals}
                  range={{ start: null, end: null }}
                  onPickDay={(day) => setSelectedDay(day)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}