import { parseISO, isWithinInterval } from "date-fns";

export function toIntervals(bookings = []) {
  return bookings
    .filter((b) => b.status === "confirmed")
    .map((b) => ({
      id: b.id,
      client: b.client_name,
      start: parseISO(b.start_date),
      end: parseISO(b.end_date),
    }))
    .filter((iv) => iv.start <= iv.end); // drop inverted/invalid ranges
}

export function bookingForDay(intervals, day) {
  return intervals.find((iv) =>
    isWithinInterval(day, { start: iv.start, end: iv.end })
  );
}

export function bookingColor(i) {
  const palette = [
    "bg-red-500/80 border-red-400/50",
    "bg-blue-500/80 border-blue-400/50",
    "bg-amber-500/80 border-amber-400/50",
    "bg-violet-500/80 border-violet-400/50",
    "bg-emerald-500/80 border-emerald-400/50",
  ];
  return palette[i % palette.length];
}

export function bookingTint(i) {
  const palette = [
    "bg-red-500/20 text-red-200 border-red-500/40",
    "bg-blue-500/20 text-blue-200 border-blue-500/40",
    "bg-amber-500/20 text-amber-200 border-amber-500/40",
    "bg-violet-500/20 text-violet-200 border-violet-500/40",
    "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  ];
  return palette[i % palette.length];
}