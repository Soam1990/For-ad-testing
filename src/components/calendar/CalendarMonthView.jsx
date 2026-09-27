import React from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { bookingColor, bookingForDay } from "./calendarHelpers";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarMonthView({ month, intervals, range, onPickDay }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const isSelected = (day) =>
    range?.start &&
    range?.end &&
    day >= range.start &&
    day <= range.end;

  const isSelEdge = (day) =>
    range?.start &&
    (isSameDay(day, range.start) || (range.end && isSameDay(day, range.end)));

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="py-1 text-center text-[9px] uppercase tracking-wider text-muted-foreground font-medium"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const b = bookingForDay(intervals, day);
          const sel = isSelected(day);
          const edge = isSelEdge(day);
          const today = isSameDay(day, new Date());
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onPickDay(day)}
              className={`relative min-h-[44px] border-b border-r border-border p-1 text-left align-top transition sm:min-h-[78px] ${
                !inMonth ? "bg-background/40 text-muted-foreground/40" : "bg-card hover:bg-secondary/40"
              } ${sel ? "ring-1 ring-inset ring-primary/60 bg-primary/10" : ""}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] sm:text-[11px] ${
                  today ? "bg-primary text-primary-foreground font-semibold" : ""
                }`}
              >
                {format(day, "d")}
              </span>
              {b && (
                <div
                  className={`mt-0.5 truncate rounded px-1 py-0.5 text-[8px] font-semibold text-white sm:text-[10px] ${bookingColor(
                    intervals.indexOf(b)
                  )}`}
                >
                  Booked
                </div>
              )}
              {edge && (
                <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}