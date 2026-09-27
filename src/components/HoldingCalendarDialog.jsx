import React, { useState, useEffect } from "react";
import { CalendarDays, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { exportReservations } from "@/lib/exportReservations";
import MapSnippet from "@/components/MapSnippet";
import OutlookCalendar from "./calendar/OutlookCalendar";

export default function HoldingCalendarDialog({ open, onOpenChange, holding, bookings = [], onBooking }) {
  const [reservations, setReservations] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open || !holding?.id) return;
    let active = true;
    (async () => {
      try {
        const rs = await base44.entities.Reservation.filter({ holding_id: holding.id });
        if (active) setReservations(rs);
      } catch {
        if (active) setReservations([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, holding?.id, tick]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[92vh] bg-card border-border text-foreground p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            {holding?.site_code} — Schedule
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 mr-8"
              onClick={() =>
                exportReservations(
                  `${holding?.site_code || "holding"}-schedule`,
                  reservations,
                  holding ? [holding] : []
                )
              }
              disabled={reservations.length === 0}
            >
              <Download size={13} className="mr-1" /> Export CSV
            </Button>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {holding?.name} · {holding?.city}
          </p>
        </DialogHeader>
        {holding && (holding.lat != null || holding.address || holding.city) && (
          <div className="px-5 pt-4">
            <MapSnippet holding={holding} className="h-32 w-full rounded-lg" />
          </div>
        )}
        <div className="px-5 py-4 max-h-[82vh] overflow-y-auto scrollbar-thin">
          <OutlookCalendar
            holding={holding}
            bookings={bookings}
            onBooking={onBooking}
            reservations={reservations}
            onReserved={() => setTick((t) => t + 1)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}