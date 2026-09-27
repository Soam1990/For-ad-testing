import React from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  isSameDay,
  isWithinInterval,
  format,
} from "date-fns";
import { bookingColor, bookingForDay } from "./calendarHelpers";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarWeekView({ cursor, intervals, range, onPickDay }) {
  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const spans = intervals.map((iv, i) => {
    const visibleDays = days.filter((d) => d >= iv.start && d <= iv.end);
    if (visibleDays.length === 0) return null;
    const firstIdx = days.findIndex((d) => isSameDay(d, visibleDays[0]));
    const lastIdx = days.findIndex((d) => isSameDay(d, visibleDays[visibleDays.length - 1]));
    return { iv, i, col: firstIdx, span: lastIdx - firstIdx + 1 };
  }).filter(Boolean);

  const isSelected = (day) =>
    range?.start && range?.end && day >= range.start && day <= range.end;

  return (
    <div className="select-none">
      {/* All-day band */}
      <div className="border-b border-border">
        <div className="grid grid-cols-[44px_repeat(7,1fr)]">
          <div className="text-[9px] text-muted-foreground p-1 text-right">All day</div>
          {days.map((day) => {
            const sel = isSelected(day);
            const today = isSameDay(day, new Date());
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => onPickDay(day)}
                className={`relative border-l border-border p-1 min-h-[34px] hover:bg-secondary/40 ${
                  sel ? "bg-primary/15" : ""
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    today ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative grid grid-cols-[44px_repeat(7,1fr)] border-t border-border">
          <div />
          {spans.map((s) => (
            <div
              key={s.iv.id}
              className={`truncate text-[10px] text-white px-1 py-0.5 m-0.5 rounded ${bookingColor(s.i)}`}
              style={{
                gridColumn: `${s.col + 2} / span ${s.span}`,
              }}
              title={`${s.iv.client}: ${format(s.iv.start, "dd MMM")} → ${format(s.iv.end, "dd MMM yyyy")}`}
            >
              {s.iv.client}
            </div>
          ))}
        </div>
      </div>

      {/* Hour grid */}
      <div className="max-h-[340px] overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-[44px_repeat(7,1fr)]">
          {HOURS.map((h) => (
            <React.Fragment key={h}>
              <div className="text-[9px] text-muted-foreground text-right pr-1 py-2 border-b border-border/50">
                {h.toString().padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const b = bookingForDay(intervals, day);
                return (
                  <div
                    key={day.toISOString() + h}
                    className={`border-l border-b border-border/50 min-h-[26px] ${
                      b ? "bg-red-500/5" : ""
                    }`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}