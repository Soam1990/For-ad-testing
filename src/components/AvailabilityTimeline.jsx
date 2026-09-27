import React from "react";
import { addMonths, addDays, differenceInDays, format } from "date-fns";

export default function AvailabilityTimeline({
  bookings = [],
  startDate,
  months = 24,
  range,
  onRangeChange,
  compact = false,
}) {
  const endDate = addMonths(startDate, months);
  const totalDays = Math.max(differenceInDays(endDate, startDate), 1);

  const monthCols = [];
  for (let i = 0; i < months; i++) {
    const mStart = addMonths(startDate, i);
    const mEnd = addMonths(startDate, i + 1);
    monthCols.push({
      mStart,
      label: format(mStart, "MMM yy"),
      width: differenceInDays(mEnd, mStart),
    });
  }

  const dayToPct = (d) => (differenceInDays(d, startDate) / totalDays) * 100;

  const handleClick = (e) => {
    if (!onRangeChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const days = Math.round((x / rect.width) * totalDays);
    const date = addDays(startDate, days);
    if (!range?.start || (range?.start && range?.end)) {
      onRangeChange({ start: date, end: null });
    } else {
      const s = date < range.start ? date : range.start;
      const en = date < range.start ? range.start : date;
      onRangeChange({ start: s, end: en });
    }
  };

  const trackHeight = compact ? "h-10" : "h-14";

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex justify-between items-center text-[11px] text-muted-foreground">
          <span className="font-medium">Availability — next 24 months</span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-red-500" /> Booked
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-primary" /> Selection
            </span>
          </div>
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[760px]">
          <div className="flex border-b border-border pb-1">
            {monthCols.map((c) => (
              <div
                key={c.label}
                style={{ flex: c.width }}
                className="px-1 text-[10px] text-muted-foreground whitespace-nowrap"
              >
                {c.label}
              </div>
            ))}
          </div>
          <div
            className={`relative ${trackHeight} mt-1.5 rounded-md bg-secondary/40 cursor-pointer border border-border`}
            onClick={handleClick}
          >
            {monthCols.map((c, i) =>
              i > 0 ? (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-border/60"
                  style={{ left: `${dayToPct(c.mStart)}%` }}
                />
              ) : null
            )}
            {bookings
              .filter((b) => b.status !== "cancelled")
              .map((b) => {
                const bs = new Date(b.start_date);
                const be = new Date(b.end_date);
                if (be < startDate || bs > endDate) return null;
                const left = dayToPct(bs < startDate ? startDate : bs);
                const right = dayToPct(be > endDate ? endDate : be);
                const width = Math.max(right - left, 1.2);
                return (
                  <div
                    key={b.id}
                    className="absolute top-1 bottom-1 rounded bg-red-500/80 border border-red-400/40"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${b.client_name}: ${format(bs, "dd MMM yyyy")} → ${format(be, "dd MMM yyyy")}`}
                  />
                );
              })}
            {range?.start && range?.end && (
              <div
                className="absolute top-0 bottom-0 rounded bg-primary/30 border border-primary"
                style={{
                  left: `${dayToPct(range.start)}%`,
                  width: `${Math.max(dayToPct(range.end) - dayToPct(range.start), 1)}%`,
                }}
              />
            )}
            {range?.start && !range?.end && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary"
                style={{ left: `${dayToPct(range.start)}%` }}
              />
            )}
          </div>
        </div>
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          Click a start point, then an end point on the timeline to select a booking window.
        </p>
      )}
    </div>
  );
}