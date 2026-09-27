import React, { useMemo } from "react";
import { MapPin } from "lucide-react";

/**
 * Renders a real Google Maps view of a holding's location.
 * Uses the keyless Google Maps embed (iframe) — no API key required.
 * Prefers lat/lng when available, falls back to the address/city string.
 */
export default function MapSnippet({ holding, className = "", zoom = 14, showLabel = true }) {
  const src = useMemo(() => {
    if (!holding) return "";
    const hasCoords =
      typeof holding.lat === "number" &&
      typeof holding.lng === "number" &&
      !Number.isNaN(holding.lat) &&
      !Number.isNaN(holding.lng);
    const q = hasCoords
      ? `${holding.lat},${holding.lng}`
      : encodeURIComponent(
          [holding.address, holding.city].filter(Boolean).join(", ") || holding.name || ""
        );
    if (!q) return "";
    return `https://maps.google.com/maps?q=${q}&z=${zoom}&output=embed`;
  }, [holding, zoom]);

  if (!holding) return null;

  const label =
    holding.address || holding.city
      ? [holding.address, holding.city].filter(Boolean).join(", ")
      : holding.name;

  return (
    <div
      className={`relative overflow-hidden border border-border bg-secondary/40 ${className}`}
    >
      {src ? (
        <iframe
          title={`Map of ${label || holding.name}`}
          src={src}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ border: 0, pointerEvents: "none" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
          No location set
        </div>
      )}
      {showLabel && label && (
        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[11px] text-foreground bg-card/85 backdrop-blur px-1.5 py-0.5 rounded max-w-[90%] truncate">
          <MapPin size={11} className="text-primary shrink-0" /> {label}
        </span>
      )}
    </div>
  );
}