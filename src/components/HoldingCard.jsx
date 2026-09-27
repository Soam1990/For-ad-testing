import React from "react";
import { MapPin, Ruler, Eye } from "lucide-react";
import { Image } from "@/components/ui/image";

const typeGradients = {
  Billboard: "from-cyan-500/25 to-blue-700/10",
  "Digital Screen": "from-fuchsia-500/25 to-cyan-500/10",
  Transit: "from-amber-500/25 to-rose-500/10",
};

export default function HoldingCard({ holding, selected, onClick }) {
  const gradient = typeGradients[holding.type] ?? "from-cyan-500/20 to-slate-700/10";
  const available = holding.status !== "booked";

  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-xl border bg-card overflow-hidden transition-all ${
        selected
          ? "border-primary ring-1 ring-primary shadow-lg shadow-primary/10"
          : "border-border hover:border-primary/50 hover:-translate-y-0.5"
      }`}
    >
      <div className="relative h-32 overflow-hidden">
        {holding.image_url ? (
          <Image
            src={holding.image_url}
            alt={holding.name}
            className="h-full w-full transition-transform group-hover:scale-105"
            fittingType="fill"
          />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium text-white ${
            available ? "bg-emerald-500/90" : "bg-red-500/90"
          }`}
        >
          {available ? "Available" : "Booked"}
        </span>
        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-[11px] text-white backdrop-blur-sm">
          {holding.type}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display font-semibold text-sm text-foreground truncate">
            {holding.site_code}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{holding.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin size={12} /> {holding.city}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
          <span className="flex items-center gap-1">
            <Ruler size={12} /> {holding.dimensions || "—"}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={12} /> {(holding.daily_impressions || 0).toLocaleString()}/d
          </span>
        </div>
      </div>
    </button>
  );
}