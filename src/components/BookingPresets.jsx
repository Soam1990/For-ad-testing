import React from "react";
import { addWeeks, addMonths } from "date-fns";

const PRESETS = [
  { label: "1 week", fn: (d) => addWeeks(d, 1) },
  { label: "2 weeks", fn: (d) => addWeeks(d, 2) },
  { label: "1 month", fn: (d) => addMonths(d, 1) },
  { label: "3 months", fn: (d) => addMonths(d, 3) },
];

export default function BookingPresets({ range, onRangeChange }) {
  const start = range?.start;
  if (!start) return null;

  const apply = (fn) => onRangeChange({ start, end: fn(start) });

  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => apply(p.fn)}
          className="px-2.5 py-1 rounded-full text-[11px] border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-primary transition"
        >
          {p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onRangeChange({ start: null, end: null })}
        className="px-2.5 py-1 rounded-full text-[11px] text-muted-foreground hover:text-foreground"
      >
        Clear
      </button>
    </div>
  );
}