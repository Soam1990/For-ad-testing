import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { MapPin, CalendarDays, ArrowLeft, Building2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import DayScheduleDialog from "@/components/DayScheduleDialog";

export default function PublicBook() {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bookingHolding, setBookingHolding] = useState(null);
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState([]);
  const [query, setQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const comp = await base44.entities.Company.get(companyId);
        setCompany(comp);
        const hs = await base44.entities.Holding.list("-created_date", 200);
        setHoldings(hs.filter((h) => h.company_id === companyId));
      } catch (e) {
        setError(e?.response?.data?.error || e.message || "Failed to load inventory.");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  const openBooking = async (h) => {
    setBookingHolding(h);
    setOpen(true);
    try {
      const res = await base44.functions.invoke("getHoldingAvailability", {
        holding_id: h.id,
      });
      setSlots((res.data || {}).slots || []);
    } catch (e) {
      setSlots([]);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? holdings.filter(
        (h) =>
          (h.name || "").toLowerCase().includes(q) ||
          (h.city || "").toLowerCase().includes(q) ||
          (h.site_code || "").toLowerCase().includes(q)
      )
    : holdings;

  const onReserved = async () => {
    if (!bookingHolding) return;
    try {
      const res = await base44.functions.invoke("getHoldingAvailability", {
        holding_id: bookingHolding.id,
      });
      setSlots((res.data || {}).slots || []);
    } catch (e) {}
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1.5 hover:bg-secondary/50"
        >
          <ArrowLeft size={18} />
          <span className="font-medium">Back</span>
        </Link>
        <Building2 size={18} className="text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="font-display font-bold text-lg sm:text-xl truncate">
            {company ? company.name : "Book a Billboard"}
          </h1>
          <p className="text-xs text-muted-foreground truncate">
            Request a reservation — pending company admin approval.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left hover:border-primary/50 transition"
              >
                <CalendarDays size={16} className="text-primary" />
                <span className="text-sm text-muted-foreground">Reserve on</span>
                <span className="text-sm font-medium">
                  {day ? format(parseISO(day), "dd MMM yyyy") : "Pick a date"}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
              <Calendar
                mode="single"
                selected={day ? parseISO(day) : undefined}
                onSelect={(d) => {
                  if (d) {
                    setDay(format(d, "yyyy-MM-dd"));
                    setDateOpen(false);
                  }
                }}
                disabled={[{ before: new Date() }]}
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 flex-1">
            <Search size={16} className="text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or city…"
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 h-8 px-0"
            />
          </div>
        </div>

        {loading ? (
          <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
        ) : error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {holdings.length === 0
              ? "This company has no inventory published yet."
              : "No billboards match your search."}
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((h) => (
              <div
                key={h.id}
                className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
              >
                <div className="relative h-40">
                  {h.image_url ? (
                    <Image
                      src={h.image_url}
                      alt={h.name}
                      className="h-full w-full"
                      fittingType="fill"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-cyan-500/25 to-slate-700/10" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="text-[11px] text-white/80">{h.type}</div>
                    <div className="font-display font-semibold text-white">
                      {h.site_code}
                    </div>
                    <div className="text-xs text-white/80 flex items-center gap-1">
                      <MapPin size={11} /> {h.city}
                    </div>
                  </div>
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <div className="text-sm font-medium truncate">{h.name}</div>
                  {h.dimensions && (
                    <div className="text-xs text-muted-foreground">{h.dimensions}</div>
                  )}
                  <Button
                    onClick={() => openBooking(h)}
                    size="lg"
                    className="mt-auto w-full h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CalendarDays size={16} className="mr-1.5" /> Reserve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DayScheduleDialog
        open={open}
        onOpenChange={setOpen}
        day={day ? new Date(day + "T00:00:00") : new Date()}
        holding={bookingHolding}
        reservations={slots}
        onReserved={onReserved}
        publicMode
      />
    </div>
  );
}