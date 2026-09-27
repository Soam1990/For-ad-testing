import React, { useState, useMemo, useEffect } from "react";
import {
  format,
  parseISO,
  isSameDay,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  isBefore,
  isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function HoldingMonthOverview({
  reservations = [],
  startDateStr,
  endDateStr,
  minDateStr,
  onSelectDate,
  readOnly = false,
}) {
  const [cursor, setCursor] = useState(() =>
    startOfMonth(startDateStr ? parseISO(startDateStr) : new Date())
  );

  // Jump to the start date's month whenever it changes, so the user sees the
  // full month containing their selected start date.
  useEffect(() => {
    if (startDateStr) {
      setCursor(startOfMonth(parseISO(startDateStr)));
    }
  }, [startDateStr]);

  const occupied = useMemo(() => {
    const s = new Set();
    (reservations || []).forEach((r) => {
      if (!r || !r.reservation_date) return;
      if (r.status === "cancelled" || r.status === "rejected") return;
      s.add(r.reservation_date);
    });
    return s;
  }, [reservations]);

  const min = minDateStr ? parseISO(minDateStr) : new Date();
  const start = startDateStr ? parseISO(startDateStr) : null;
  const end = endDateStr ? parseISO(endDateStr) : null;

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const minMonth = startOfMonth(min);
  const canPrev = isAfter(monthStart, minMonth);

  const days = [];
  let cur = startOfWeek(monthStart, { weekStartsOn: 0 });
  while (days.length < 42) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const dayClass = (d) => {
    const dStr = format(d, "yyyy-MM-dd");
    const inMonth = isSameMonth(d, cursor);
    const isPast = isBefore(d, min) && !isSameDay(d, min);
    const isOcc = occupied.has(dStr);
    const isStart = start && isSameDay(d, start);
    const isEnd = end && isSameDay(d, end);
    const inRange = start && end && isAfter(d, start) && isBefore(d, end);
    const isToday = isSameDay(d, new Date());

    let cls = "h-8 w-8 rounded-md text-[11px] flex items-center justify-center border transition relative ";
    if (isStart || isEnd) {
      cls +=
        "!bg-primary !text-primary-foreground !border-primary font-semibold ring-2 ring-primary/50 ";
    } else if (inRange) {
      cls += "bg-primary/15 border-primary/40 text-primary-foreground ";
    } else if (!inMonth) {
      cls += "border-transparent text-muted-foreground/50 ";
    } else if (isPast) {
      cls += "bg-secondary/20 border-transparent text-muted-foreground/40 cursor-not-allowed ";
    } else if (isOcc) {
      cls +=
        "bg-red-500/30 border-red-500/70 text-red-50 shadow-[0_0_6px_-2px_rgba(239,68,68,0.7)] ";
    } else {
      cls +=
        "bg-emerald-500/25 border-emerald-400/70 text-emerald-50 shadow-[0_0_6px_-2px_rgba(16,185,129,0.7)] ";
    }
    if (isToday && !isStart && !isEnd) cls += "outline outline-1 outline-primary/60 ";
    return { cls, inMonth, isPast, beforeStart: start ? isBefore(d, start) : false };
  };

  const clickable = (d) => {
    if (readOnly) return false;
    const inMonth = isSameMonth(d, cursor);
    const isPast = isBefore(d, min) && !isSameDay(d, min);
    // Any future, in-month date is clickable so the user can click a new
    // start date even after a start is already chosen (restarts the range).
    return inMonth && !isPast;
  };

  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => canPrev && setCursor((c) => addMonths(c, -1))}
          disabled={!canPrev}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium font-display">
          {format(cursor, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* weekday row */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-[10px] text-muted-foreground/70 text-center font-medium"
          >
            {w}
          </div>
        ))}
      </div>

      {/* days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const { cls } = dayClass(d);
          const can = clickable(d);
          return (
            <button
              key={i}
              type="button"
              disabled={!can}
              onClick={can ? () => onSelectDate?.(format(d, "yyyy-MM-dd")) : undefined}
              className={cls}
              title={format(d, "dd MMM yyyy")}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/40 border border-emerald-400/70" />
          Vacant
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500/40 border border-red-500/70" />
          Occupied
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary border border-primary" />
          Selected
        </span>
      </div>
    </div>
  );
}