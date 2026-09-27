import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar, User, CheckCircle2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AvailabilityTimeline from "./AvailabilityTimeline";
import BookingPresets from "./BookingPresets";
import MapSnippet from "./MapSnippet";

export default function MobileBookingSheet({
  open,
  onOpenChange,
  holding,
  bookings,
  startDate,
  onBooking,
}) {
  const [range, setRange] = useState({ start: null, end: null });
  const [client, setClient] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setRange({ start: null, end: null });
    setClient("");
  }, [holding?.id, open]);

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
      onOpenChange(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border text-foreground max-h-[92vh]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="font-display text-base">
            {holding?.site_code} — {holding?.name}
          </DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
          <MapSnippet holding={holding} />
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
              Availability Timeline
            </h3>
            <AvailabilityTimeline
              bookings={bookings}
              startDate={startDate}
              range={range}
              onRangeChange={setRange}
            />
          </div>
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
        </div>
        <DrawerFooter className="border-t border-border bg-card">
          <Button
            onClick={createBooking}
            disabled={!canCreate}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CheckCircle2 size={16} className="mr-1.5" />
            {creating ? "Creating…" : "Create Booking"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}