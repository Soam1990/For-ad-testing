import React, { useState, useMemo, useEffect } from "react";
import { format, parseISO, addDays, isBefore } from "date-fns";
import { Clock, CheckCircle2, AlertTriangle, CalendarDays, MailCheck, Undo2, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import HoldingMonthOverview from "@/components/HoldingMonthOverview";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n) => n.toString().padStart(2, "0");

export default function DayScheduleDialog({
  open,
  onOpenChange,
  day,
  holding,
  reservations = [],
  onReserved,
  publicMode = false,
}) {
  const [mode, setMode] = useState("fullday"); // "hours" | "fullday"
  const [startH, setStartH] = useState(null);
  const [endH, setEndH] = useState(null); // inclusive last booked hour
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [reqName, setReqName] = useState("");
  const [reqCompany, setReqCompany] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqPhone, setReqPhone] = useState("");
  // Admin manual booking: client details (same shape as the public booking page)
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [endDate, setEndDate] = useState(""); // yyyy-MM-dd; multi-day range end (public mode)
  const [activeDay, setActiveDay] = useState(day); // local start date (editable inside the dialog)
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    setMode("fullday");
    setStartH(null);
    setEndH(null);
    setError("");
    setConfirmation(null);
    setReqName("");
    setReqCompany("");
    setReqEmail("");
    setReqPhone("");
    setClientName("");
    setClientCompany("");
    setClientEmail("");
    setClientPhone("");
    setActiveDay(day);
    setEndDate(day ? format(day, "yyyy-MM-dd") : "");
    setOtpStep(false);
    setOtpCode("");
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpError("");
  }, [day, holding?.id, open]);

  const dayReservations = useMemo(() => {
    if (!activeDay) return [];
    const key = format(activeDay, "yyyy-MM-dd");
    return reservations.filter(
      (r) =>
        r.status !== "cancelled" &&
        r.status !== "rejected" &&
        r.reservation_date === key
    );
  }, [reservations, activeDay]);

  // map of hour -> reservation occupying it
  const hourMap = useMemo(() => {
    const m = {};
    dayReservations.forEach((r) => {
      const s = parseInt(r.start_time.slice(0, 2), 10);
      const e = parseInt(r.end_time.slice(0, 2), 10);
      for (let h = s; h < e; h++) m[h] = r;
    });
    return m;
  }, [dayReservations]);

  const selStart = startH;
  const selEnd = endH == null ? null : endH + 1; // exclusive end hour
  const isFullDay = mode === "fullday";
  const bookedCount = Object.keys(hourMap).length;
  const fullDayBlocked = bookedCount > 0;

  // Occupied-hour map for any date string (yyyy-MM-dd) across all loaded slots.
  const occupiedHoursFor = (dateStr) => {
    const m = {};
    reservations.forEach((r) => {
      if (
        r &&
        r.status !== "cancelled" &&
        r.status !== "rejected" &&
        r.reservation_date === dateStr
      ) {
        const s = parseInt((r.start_time || "00:00").slice(0, 2), 10);
        const e = parseInt((r.end_time || "00:00").slice(0, 2), 10);
        for (let h = s; h < e; h++) m[h] = r;
      }
    });
    return m;
  };

  // List of date strings covered by the reservation request (start..end inclusive).
  const rangeDays = useMemo(() => {
    if (!activeDay) return [];
    const startStr = format(activeDay, "yyyy-MM-dd");
    const start = new Date(startStr + "T00:00:00");
    let end = endDate ? new Date(endDate + "T00:00:00") : start;
    if (isBefore(end, start)) end = start;
    const out = [];
    let cur = new Date(start);
    while (cur <= end && out.length < 90) {
      out.push(format(cur, "yyyy-MM-dd"));
      cur = addDays(cur, 1);
    }
    return out;
  }, [activeDay, endDate]);

  // Dates in the range that conflict with existing reservations for the chosen time.
  const rangeConflicts = useMemo(() => {
    if (rangeDays.length === 0) return [];
    if (isFullDay) {
      return rangeDays.filter((d) => Object.keys(occupiedHoursFor(d)).length > 0);
    }
    if (selStart == null || selEnd == null) return [];
    return rangeDays.filter((d) => {
      const occ = occupiedHoursFor(d);
      for (let h = selStart; h < selEnd; h++) if (occ[h]) return true;
      return false;
    });
  }, [rangeDays, isFullDay, selStart, selEnd, reservations]);

  const selectionOverlaps = useMemo(() => {
    if (selStart == null || selEnd == null) return false;
    for (let h = selStart; h < selEnd; h++) {
      if (hourMap[h]) return true;
    }
    return false;
  }, [selStart, selEnd, hourMap]);

  // Full Day is the default. Admins fall back to Specific hours automatically
  // when the start day already has reserved hours; the public portal stays on
  // Full day (with a guided message to switch if the day is blocked).
  useEffect(() => {
    if (!publicMode && isFullDay && fullDayBlocked) setMode("hours");
  }, [isFullDay, fullDayBlocked, publicMode]);

  const clickHour = (h) => {
    if (confirmation) return;
    if (isFullDay) return;
    if (hourMap[h]) return; // reserved — can't select
    setError("");
    if (startH == null || (startH != null && endH != null)) {
      setStartH(h);
      setEndH(null);
    } else if (h > startH) {
      setEndH(h);
    } else {
      // clicked before start — restart
      setStartH(h);
      setEndH(null);
    }
  };

  const canReserve = !submitting && rangeDays.length >= 1 && rangeConflicts.length === 0 && (
    isFullDay
      ? !fullDayBlocked
      : selStart != null && selEnd != null && !selectionOverlaps
  ) && (publicMode
    ? (reqName.trim() && reqCompany.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reqEmail.trim()))
    : (clientName.trim() && clientCompany.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())));

  const runCreateLoop = async () => {
    if (!canReserve || !activeDay || !holding) return;
    setSubmitting(true);
    setError("");
    const startTime = isFullDay ? "00:00" : `${pad(selStart)}:00`;
    const endTime = isFullDay ? "23:59" : `${pad(selEnd)}:00`;
    // One shared id groups all dates/times of this submission into a single
    // request on the admin side.
    const requestId =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const results = [];
    let anyEmailFailed = false;
    let firstEmailError = "";
    try {
      for (const dateStr of rangeDays) {
        const payload = {
          holding_id: holding.id,
          reservation_date: dateStr,
          start_time: startTime,
          end_time: endTime,
          request_id: requestId,
        };
        if (publicMode) {
          payload.requester_name = reqName.trim();
          payload.requester_company = reqCompany.trim();
          payload.requester_email = reqEmail.trim();
          payload.requester_phone = reqPhone.trim();
        } else {
          payload.client_name = clientName.trim();
          payload.client_company = clientCompany.trim();
          payload.client_email = clientEmail.trim();
          payload.client_phone = clientPhone.trim();
        }
        try {
          const res = await base44.functions.invoke(
            publicMode ? "createPublicReservation" : "createReservation",
            payload
          );
          const data = res.data || {};
          if (data.error) {
            results.push({ date: dateStr, ok: false, error: data.error });
          } else {
            results.push({ date: dateStr, ok: true });
            if (data.emailSent === false) {
              anyEmailFailed = true;
              if (!firstEmailError && data.emailError) firstEmailError = data.emailError;
            }
          }
        } catch (e) {
          results.push({
            date: dateStr,
            ok: false,
            error: e?.response?.data?.error || e.message || "Failed to create reservation.",
          });
        }
      }
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      if (succeeded.length === 0) {
        setError(
          failed[0]?.error || "No reservations could be created — check conflicts and retry."
        );
      } else {
        const first = rangeDays[0];
        const last = rangeDays[rangeDays.length - 1];
        const rangeLabel =
          rangeDays.length === 1
            ? format(new Date(first + "T00:00:00"), "EEEE, dd MMMM yyyy")
            : `${format(new Date(first + "T00:00:00"), "dd MMM")} → ${format(
                new Date(last + "T00:00:00"),
                "dd MMM yyyy"
              )} (${rangeDays.length} days)`;
        setConfirmation({
          billboard: holding.name,
          rangeLabel,
          time: `${startTime} – ${endTime}`,
          count: succeeded.length,
          total: results.length,
          failed,
          emailSent: !anyEmailFailed,
          emailError: firstEmailError,
        });
        if (onReserved) onReserved();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const beginReserve = async () => {
    if (!canReserve || !day || !holding) return;
    if (publicMode) {
      // Verify the requester controls the email before creating any reservation.
      setOtpError("");
      setOtpSending(true);
      try {
        await base44.functions.invoke("bookingOtp", {
          action: "send",
          email: reqEmail.trim(),
          name: reqName.trim(),
        });
        setOtpStep(true);
      } catch (e) {
        setOtpError(e?.response?.data?.error || e.message || "Failed to send verification code.");
      } finally {
        setOtpSending(false);
      }
      return;
    }
    await runCreateLoop();
  };

  const resendOtp = async () => {
    setOtpError("");
    setOtpSending(true);
    try {
      await base44.functions.invoke("bookingOtp", {
        action: "send",
        email: reqEmail.trim(),
        name: reqName.trim(),
      });
    } catch (e) {
      setOtpError(e?.response?.data?.error || e.message || "Failed to resend code.");
    } finally {
      setOtpSending(false);
    }
  };

  const verifyAndSubmit = async () => {
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpError("");
    setOtpVerifying(true);
    try {
      const res = await base44.functions.invoke("bookingOtp", {
        action: "verify",
        email: reqEmail.trim(),
        code: otpCode.trim(),
      });
      if (res.data?.error) {
        setOtpError(res.data.error);
        return;
      }
      setOtpStep(false);
      await runCreateLoop();
    } catch (e) {
      setOtpError(e?.response?.data?.error || e.message || "Verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const resetSelection = () => {
    setStartH(null);
    setEndH(null);
    setEndDate(activeDay ? format(activeDay, "yyyy-MM-dd") : "");
    setMode("fullday");
    setOtpStep(false);
    setOtpCode("");
    setOtpError("");
  };

  // Two-click range selection on the public calendar:
  //  1st click sets the START date (range collapses to a single day),
  //  2nd click on a later date sets the END date.
  //  Clicking before/at the start, or clicking once a real range exists,
  //  starts a new range.
  const onCalendarSelectDate = (d) => {
    const startStr = activeDay ? format(activeDay, "yyyy-MM-dd") : "";
    const hasRange = startStr && endDate && endDate !== startStr;
    setError("");
    if (!startStr || hasRange || d < startStr) {
      const nd = new Date(d + "T00:00:00");
      setActiveDay(nd);
      setEndDate(d);
      setStartH(null);
      setEndH(null);
      return;
    }
    // same as start → keep single day
    if (d === startStr) {
      setEndDate(d);
      return;
    }
    // later than start → set as end
    setEndDate(d);
  };

  const hourState = (h) => {
    if (hourMap[h]) return "reserved";
    if (isFullDay) return "selected";
    if (selStart != null && selEnd != null && h >= selStart && h < selEnd) return "selected";
    if (selStart === h && selEnd == null) return "selected";
    return "available";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg bg-card border-border text-foreground p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            {activeDay ? format(activeDay, "EEEE, dd MMM yyyy") : "Schedule"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <CalendarDays size={12} className="text-primary" />
            {holding?.name} · {holding?.site_code} · {holding?.city}
          </p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[82vh] overflow-y-auto scrollbar-thin">
          {confirmation ? (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-200 px-4 py-3 flex items-start gap-2">
                <Clock size={18} className="mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">
                    Reservation submitted — pending admin approval
                    {confirmation.count > 1 && ` (${confirmation.count} days)`}
                  </div>
                  <div className="text-xs mt-1 space-y-0.5 text-emerald-100/90">
                    <div>Billboard: {confirmation.billboard}</div>
                    <div>Dates: {confirmation.rangeLabel}</div>
                    <div>Time: {confirmation.time}</div>
                  </div>
                  {confirmation.failed && confirmation.failed.length > 0 && (
                    <div className="text-[11px] mt-1 text-red-200/90">
                      {confirmation.failed.length} day(s) could not be booked:
                      {" "}
                      {confirmation.failed.map((f) => format(new Date(f.date + "T00:00:00"), "dd MMM")).join(", ")}
                    </div>
                  )}
                </div>
              </div>
              {confirmation.emailSent === false && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-200 px-4 py-2.5 flex items-start gap-2 text-xs">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Reservation saved, but the notification email could not be sent.
                    {confirmation.emailError ? ` (${confirmation.emailError})` : ""}
                  </span>
                </div>
              )}
              <Button
                onClick={() => onOpenChange(false)}
                className="w-full h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 p-1">
                <button
                  type="button"
                  onClick={() => setMode("fullday")}
                  disabled={fullDayBlocked}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    mode === "fullday"
                      ? "bg-primary text-primary-foreground"
                      : fullDayBlocked
                      ? "text-muted-foreground/50 cursor-not-allowed"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Full day
                </button>
                <button
                  type="button"
                  onClick={() => setMode("hours")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    mode === "hours"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Specific hours
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isFullDay
                  ? "Reserves the entire day (00:00 – 23:59). Available only when no hour is already reserved."
                  : "Click an available hour to set the start, then click a later hour for the end. Reserved and pending hours cannot be selected."}
              </p>

              {/* Start & End date */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Start date</label>
                  <Input
                    type="date"
                    value={activeDay ? format(activeDay, "yyyy-MM-dd") : ""}
                    min={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        const nd = new Date(v + "T00:00:00");
                        setActiveDay(nd);
                        setEndDate(v);
                        setStartH(null);
                        setEndH(null);
                        setError("");
                      }
                    }}
                    className="bg-background h-9 w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">End date</label>
                  <Input
                    type="date"
                    value={endDate || ""}
                    min={activeDay ? format(activeDay, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        const startStr = activeDay ? format(activeDay, "yyyy-MM-dd") : v;
                        if (v < startStr) {
                          const nd = new Date(v + "T00:00:00");
                          setActiveDay(nd);
                          setEndDate(v);
                        } else {
                          setEndDate(v);
                        }
                        setStartH(null);
                        setEndH(null);
                        setError("");
                      }
                    }}
                    className="bg-background h-9 w-auto"
                  />
                </div>
              </div>

              {/* Multi-day range */}
              <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays size={13} className="text-primary" />
                    <span className="font-medium text-foreground">Reserve multiple days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {rangeDays.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/40 text-primary px-2.5 py-0.5 text-[11px] font-medium">
                        <Clock size={11} /> {rangeDays.length} day{rangeDays.length === 1 ? "" : "s"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={resetSelection}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Undo2 size={11} /> Undo
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground">Start </span>
                    <span className="font-medium">
                      {activeDay ? format(activeDay, "dd MMM yyyy") : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End </span>
                    <span className="font-medium">
                      {endDate ? format(parseISO(endDate), "dd MMM yyyy") : "Tap a day →"}
                    </span>
                  </div>
                </div>
                <HoldingMonthOverview
                  reservations={reservations}
                  startDateStr={activeDay ? format(activeDay, "yyyy-MM-dd") : ""}
                  endDateStr={endDate}
                  minDateStr={format(new Date(), "yyyy-MM-dd")}
                  onSelectDate={onCalendarSelectDate}
                />
                <p className="text-[11px] text-muted-foreground">
                  Click a date to set the <b>start</b>, then click a later date for the <b>end</b>. The {isFullDay ? "full-day" : "selected hours"} block applies to every day in the range.
                </p>
              </div>

              {/* 24-hour timeline */}
              <div className="grid grid-cols-2 gap-1">
                {HOURS.map((h) => {
                  const state = hourState(h);
                  const r = hourMap[h];
                  const base =
                    "rounded-md border px-2 py-1 text-[10px] flex items-center justify-between gap-1 transition min-h-0";
                  if (state === "reserved") {
                    const isPending = r.status === "pending";
                    const palette = isPending
                      ? "border-amber-500/40 bg-amber-500/20 text-amber-100"
                      : "border-red-500/40 bg-red-500/20 text-red-100";
                    const subText = isPending ? "text-amber-200/80" : "text-red-200/80";
                    return (
                      <div key={h} className={`${base} ${palette}`}>
                        <span className="font-medium shrink-0">{pad(h)}:00</span>
                        <span className={`truncate ${subText}`}>
                          {isPending ? "Pending" : "Confirmed"}
                        </span>
                      </div>
                    );
                  }
                  if (state === "selected") {
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => clickHour(h)}
                        className={`${base} border-primary bg-primary/30 text-primary-foreground`}
                      >
                        <span className="font-medium shrink-0">{pad(h)}:00</span>
                        <span className="truncate">Selected</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => clickHour(h)}
                      className={`${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-200/80 hover:bg-emerald-500/20`}
                    >
                      <span className="font-medium shrink-0">{pad(h)}:00</span>
                      <span className="truncate">Free</span>
                    </button>
                  );
                })}
              </div>

              {/* Selection summary */}
              <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Selected period</span>
                  <span className="font-medium font-mono">
                    {isFullDay
                      ? "00:00 – 23:59 (full day)"
                      : selStart != null && selEnd != null
                      ? `${pad(selStart)}:00 – ${pad(selEnd)}:00`
                      : selStart != null
                      ? `${pad(selStart)}:00 – …`
                      : "—"}
                  </span>
                </div>
                {isFullDay && fullDayBlocked && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {bookedCount} hour{bookedCount === 1 ? "" : "s"} already reserved — full day unavailable. Switch to Specific hours.
                  </p>
                )}
                {!isFullDay && selectionOverlaps && (
                  <p className="text-[11px] text-red-400 mt-1">
                    Selection overlaps a reserved slot on the start day — pick a free period.
                  </p>
                )}
                {rangeDays.length > 1 && rangeConflicts.length > 0 && (
                  <p className="text-[11px] text-red-400 mt-1">
                    {rangeConflicts.length} day(s) in the range already have a conflict:
                    {" "}
                    {rangeConflicts
                      .map((d) => format(new Date(d + "T00:00:00"), "dd MMM"))
                      .join(", ")}
                    . Shorten the range or change the time.
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-xs px-3 py-2 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Requester info (public bookings only) */}
              {publicMode && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tell the company admin who's requesting this booking.
                  </p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Requester's Name</span>
                    <Input
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Your full name"
                      className="bg-background h-9"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Company Name</span>
                    <Input
                      value={reqCompany}
                      onChange={(e) => setReqCompany(e.target.value)}
                      placeholder="Your company"
                      className="bg-background h-9"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Email Address</span>
                    <Input
                      type="email"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="bg-background h-9"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      A confirmation email will be sent here, plus the decision once an admin reviews it.
                    </span>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Phone Number</span>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={reqPhone}
                      onChange={(e) => setReqPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="bg-background h-9"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      So the company admin can reach you about this booking.
                    </span>
                  </label>
                </div>
              )}

              {/* Client details (admin manual booking) — same fields as the public page */}
              {!publicMode && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Who is this booking for? Enter the client's details.
                  </p>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Client Name</span>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client's full name"
                      className="bg-background h-9"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Client Company</span>
                    <Input
                      value={clientCompany}
                      onChange={(e) => setClientCompany(e.target.value)}
                      placeholder="Client's company"
                      className="bg-background h-9"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Client Email</span>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@company.com"
                      className="bg-background h-9"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Client Phone</span>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+1 555 123 4567"
                      className="bg-background h-9"
                    />
                  </label>
                </div>
              )}

              {/* OTP verification (public bookings) */}
              {publicMode && otpStep && (
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs flex items-start gap-2">
                    <MailCheck size={15} className="mt-0.5 shrink-0 text-primary" />
                    <span className="text-foreground/90">
                      We sent a 6-digit verification code to <b className="text-primary">{reqEmail}</b>. Enter it below to confirm your booking.
                    </span>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium">Verification code</span>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="bg-background h-9 tracking-[0.4em] text-center font-mono"
                    />
                  </label>
                  {otpError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-xs px-3 py-2 flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpStep(false);
                        setOtpCode("");
                        setOtpError("");
                      }}
                      className="flex-1 h-11"
                    >
                      <ArrowLeft size={15} className="mr-1.5" /> Back
                    </Button>
                    <Button
                      onClick={verifyAndSubmit}
                      disabled={otpVerifying}
                      className="flex-[2] h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {otpVerifying ? "Verifying…" : "Verify & Submit"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={otpSending}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    {otpSending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              )}

              {/* Client + reserve */}
              {!(publicMode && otpStep) && (
                <div className="border-t border-border pt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1 h-11"
                  >
                    <ArrowLeft size={15} className="mr-1.5" /> Back
                  </Button>
                  <Button
                    onClick={beginReserve}
                    disabled={!canReserve || otpSending}
                    className="flex-[2] h-11 text-base bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle2 size={16} className="mr-1.5" />
                    {otpSending ? "Sending code…" : submitting ? "Reserving…" : "Confirm Reservation"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}