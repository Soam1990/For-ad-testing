import React from "react";
import { isSameDay, format } from "date-fns";
import { bookingForDay, bookingTint } from "./calendarHelpers";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function CalendarDayView({ day, intervals, range, onPickDay }) {
  const b = bookingForDay(intervals, day);
  const sel = range?.start && range?.end && day >= range.start && day <= range.end;
  const idx = b ? intervals.indexOf(b) : 0;

  return (
    <div className="select-none space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-base">
            {format(day, "EEEE")}
          </div>
          <div className="text-xs text-muted-foreground">{format(day, "dd MMMM yyyy")}</div>
        </div>
        <button
          type="button"
          onClick={() => onPickDay(day)}
          className={`px-3 py-1 rounded-md text-xs border ${
            sel ? "bg-primary/15 border-primary" : "border-border bg-secondary/30 hover:bg-secondary/60"
          }`}
        >
          {sel ? "In selection" : "Select this day"}
        </button>
      </div>

      <div
        className={`rounded-md border px-3 py-2 text-sm ${bookingTint(idx)} ${b ? "" : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"}`}
      >
        {b ? (
          <>
            <span className="font-medium">Booked</span> — {b.client}
            <span className="block text-xs text-muted-foreground mt-0.5">
              {format(b.start, "dd MMM")} → {format(b.end, "dd MMM yyyy")}
            </span>
          </>
        ) : (
          <span className="font-medium">Available</span>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto scrollbar-thin grid grid-cols-[52px_1fr] border-t border-border">
        {HOURS.map((h) => (
          <React.Fragment key={h}>
            <div className="text-[10px] text-muted-foreground text-right pr-2 py-2 border-b border-border/50">
              {h.toString().padStart(2, "0")}:00
            </div>
            <div
              className={`border-b border-l border-border/50 min-h-[24px] ${
                b ? "bg-red-500/5" : ""
              }`}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}