import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Building2, Ruler, Eye, MapPin, User, Calendar, CheckCircle2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AvailabilityTimeline from "./AvailabilityTimeline";
import BookingPresets from "./BookingPresets";
import HoldingCalendarDialog from "./HoldingCalendarDialog";
import MapSnippet from "./MapSnippet";

export default function InspectorPanel({ holding, bookings, startDate, onBooking }) {
  const [range, setRange] = useState({ start: null, end: null });
  const [client, setClient] = useState("");
  const [creating, setCreating] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    setRange({ start: null, end: null });
    setClient("");
  }, [holding?.id]);

  const canCreate = range?.start && range?.end && client.trim() && !creating;

  const createBooking = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      await onBooking({
        holding_id: holding.id,
        client_name: client.trim(),
        start_date: format(range.start, "yyyy-MM-dd"),
        end_date: format(range.end, "yyyy-MM-dd"),
      });
      setRange({ start: null, end: null });
      setClient("");
    } finally {
      setCreating(false);
    }
  };

  if (!holding) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Select a holding to inspect its availability.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top half: map + metadata */}
      <div className="p-4 space-y-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-primary font-medium">
              {holding.site_code}
            </div>
            <h2 className="font-display font-semibold text-lg leading-tight">
              {holding.name}
            </h2>
          </div>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              holding.status === "available"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {holding.status === "available" ? "Available" : "Booked"}
          </span>
        </div>

        <MapSnippet holding={holding} />

        <Button
          variant="outline"
          onClick={() => setCalOpen(true)}
          className="w-full justify-start bg-background"
        >
          <CalendarDays size={15} className="mr-1.5 text-primary" />
          View full calendar
        </Button>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Meta icon={Building2} label="Type" value={holding.type} />
          <Meta icon={MapPin} label="City" value={holding.city} />
          <Meta icon={Ruler} label="Dimensions" value={holding.dimensions || "—"} />
          <Meta
            icon={Eye}
            label="Daily impressions"
            value={(holding.daily_impressions || 0).toLocaleString()}
          />
        </div>
      </div>

      {/* Bottom half: timeline + booking */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <div>
          <SectionTitle>Availability Timeline</SectionTitle>
          <AvailabilityTimeline
            bookings={bookings}
            startDate={startDate}
            range={range}
            onRangeChange={setRange}
          />
        </div>

        <div className="space-y-2">
          <SectionTitle>Active Bookings</SectionTitle>
          {bookings.filter((b) => b.status !== "cancelled").length === 0 ? (
            <p className="text-xs text-muted-foreground">No active bookings.</p>
          ) : (
            <ul className="space-y-1.5">
              {bookings
                .filter((b) => b.status !== "cancelled")
                .map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <User size={12} className="text-muted-foreground" />
                      <span className="truncate">{b.client_name}</span>
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                      <Calendar size={12} />
                      {format(new Date(b.start_date), "dd MMM")} →{" "}
                      {format(new Date(b.end_date), "dd MMM yy")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Footer: create booking */}
      <div className="border-t border-border p-4 space-y-3 bg-card">
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start</span>
            <Input
              type="date"
              value={range?.start ? format(range.start, "yyyy-MM-dd") : ""}
              onChange={(e) =>
                setRange((r) => ({
                  start: e.target.value ? new Date(e.target.value) : null,
                  end: r?.end,
                }))
              }
              className="bg-background"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">End</span>
            <Input
              type="date"
              value={range?.end ? format(range.end, "yyyy-MM-dd") : ""}
              onChange={(e) =>
                setRange((r) => ({
                  start: r?.start,
                  end: e.target.value ? new Date(e.target.value) : null,
                }))
              }
              className="bg-background"
            />
          </label>
        </div>
        <BookingPresets range={range} onRangeChange={setRange} />
        <Input
          placeholder="Client name"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className="bg-background"
        />
        <Button
          onClick={createBooking}
          disabled={!canCreate}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <CheckCircle2 size={16} className="mr-1.5" />
          {creating ? "Creating…" : "Create Booking"}
        </Button>
      </div>

      <HoldingCalendarDialog
        open={calOpen}
        onOpenChange={setCalOpen}
        holding={holding}
        bookings={bookings}
        onBooking={onBooking}
      />
    </div>
  );
}

function Meta({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon size={11} /> {label}
      </div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
      {children}
    </h3>
  );
}