import React, { useState, useMemo } from "react";
import {
  addMonths,
  addWeeks,
  addDays,
  startOfMonth,
  startOfWeek,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseISO } from "date-fns";
import { toIntervals } from "./calendarHelpers";
import CalendarMonthView from "./CalendarMonthView";
import CalendarWeekView from "./CalendarWeekView";
import CalendarDayView from "./CalendarDayView";
import DayScheduleDialog from "../DayScheduleDialog";

const VIEWS = ["Month", "Week", "Day"];

export default function OutlookCalendar({ holding, bookings = [], onBooking, reservations = [], onReserved }) {
  const [view, setView] = useState("Month");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [range, setRange] = useState({ start: null, end: null });

  const intervals = useMemo(() => toIntervals(bookings), [bookings]);

  // Confirmed reservations rendered as single-day blocks labeled with the
  // client (requester) name, so admins see approved bookings on the calendar.
  const reservationIntervals = useMemo(
    () =>
      (reservations || [])
        .filter((r) => r && r.status === "confirmed")
        .map((r) => {
          const d = r.reservation_date ? parseISO(r.reservation_date) : null;
          const client =
            r.user_name || r.requester_company || "Confirmed booking";
          return d
            ? { id: `res-${r.id}`, client, start: d, end: d, isReservation: true }
            : null;
        })
        .filter(Boolean),
    [reservations]
  );

  const displayIntervals = useMemo(
    () => [...intervals, ...reservationIntervals],
    [intervals, reservationIntervals]
  );

  const label = useMemo(() => {
    if (view === "Month") return format(cursor, "MMMM yyyy");
    if (view === "Week") {
      const ws = startOfWeek(cursor);
      return `${format(ws, "dd MMM")} – ${format(addDays(ws, 6), "dd MMM yyyy")}`;
    }
    return format(cursor, "EEEE, dd MMM yyyy");
  }, [view, cursor]);

  const prev = () =>
    setCursor((c) =>
      view === "Month" ? addMonths(c, -1) : view === "Week" ? addWeeks(c, -1) : addDays(c, -1)
    );
  const next = () =>
    setCursor((c) =>
      view === "Month" ? addMonths(c, 1) : view === "Week" ? addWeeks(c, 1) : addDays(c, 1)
    );

  const openDay = (day) => setSelectedDay(day);
  const toggleDay = (day) => {
    if (!range.start || (range.start && range.end)) {
      setRange({ start: day, end: null });
    } else {
      const s = day < range.start ? day : range.start;
      const e = day < range.start ? range.start : day;
      setRange({ start: s, end: e });
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={prev}>
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={next}>
            <ChevronRight size={18} />
          </Button>
          <span className="font-display font-semibold text-base ml-1">{label}</span>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium transition ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* View */}
      <div className="rounded-md border border-border overflow-x-auto scrollbar-thin">
        {view === "Month" && (
          <CalendarMonthView month={cursor} intervals={displayIntervals} range={range} onPickDay={openDay} />
        )}
        {view === "Week" && (
          <CalendarWeekView cursor={cursor} intervals={displayIntervals} range={range} onPickDay={openDay} />
        )}
        {view === "Day" && (
          <CalendarDayView day={cursor} intervals={displayIntervals} range={range} onPickDay={toggleDay} />
        )}
      </div>

      {/* 24-hour day grid */}
      <DayScheduleDialog
        open={!!selectedDay}
        onOpenChange={(o) => !o && setSelectedDay(null)}
        day={selectedDay}
        holding={holding}
        reservations={reservations}
        onReserved={onReserved}
      />
    </div>
  );
}