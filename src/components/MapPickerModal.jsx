import React, { useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, Loader2, ExternalLink, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Fix default marker icon under bundlers
const pinIcon = L.icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center]);
  return null;
}

const REVERSE = "https://nominatim.openstreetmap.org/reverse";

export default function MapPickerModal({ open, onOpenChange, onConfirm, initial }) {
  const [pin, setPin] = useState(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [reverse, setReverse] = useState(null);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [center, setCenter] = useState([43.6532, -79.3832]);

  useEffect(() => {
    if (!open) return;
    if (initial?.lat != null && initial?.lng != null) {
      const c = [Number(initial.lat), Number(initial.lng)];
      setCenter(c);
      setPin(c);
    } else {
      setCenter([43.6532, -79.3832]);
      setPin(null);
    }
    setReverse(null);
    setSearch(initial?.address ? `${initial.address} ${initial.city || ""}`.trim() : "");
  }, [open, initial?.lat, initial?.lng, initial?.address, initial?.city]);

  const doReverse = async (lat, lng) => {
    setReverseLoading(true);
    try {
      const url = `${REVERSE}?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      const a = data?.address || {};
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      const city =
        a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state || "";
      setReverse({
        address: street || data?.display_name || "",
        city,
        full: data?.display_name || "",
      });
    } catch {
      setReverse(null);
    } finally {
      setReverseLoading(false);
    }
  };

  const pick = ({ lat, lng }) => {
    const c = [lat, lng];
    setPin(c);
    doReverse(lat, lng);
  };

  const doSearch = async () => {
    const q = search.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      const top = Array.isArray(data) && data[0];
      if (top) {
        const c = [Number(top.lat), Number(top.lon)];
        setCenter(c);
        setPin(c);
        doReverse(Number(top.lat), Number(top.lon));
      }
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  };

  const confirm = () => {
    if (!pin) return;
    onConfirm?.({
      lat: pin[0],
      lng: pin[1],
      address: reverse?.address || "",
      city: reverse?.city || "",
    });
    onOpenChange?.(false);
  };

  const googleLink = useMemo(
    () =>
      pin
        ? `https://www.google.com/maps/search/?api=1&query=${pin[0]},${pin[1]}`
        : "https://www.google.com/maps",
    [pin]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="font-display flex items-center gap-2">
            <MapPin size={18} className="text-primary" /> Pick holding location
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Click the map to drop a pin, or search an address. Coordinates will fill into the form.
          </p>
        </DialogHeader>

        <div className="px-5 py-3 space-y-3">
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
              placeholder="Search an address or place…"
              className="bg-background"
            />
            <Button type="button" onClick={doSearch} disabled={searching} className="shrink-0">
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Search
            </Button>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-border h-80 bg-secondary/40">
            <MapContainer
              center={center}
              zoom={13}
              scrollWheelZoom
              className="h-full w-full"
              style={{ background: "#0f172a" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ClickHandler onPick={pick} />
              <Recenter center={center} />
              {pin && <Marker position={pin} icon={pinIcon} />}
            </MapContainer>
          </div>

          <div className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0 space-y-1">
              {pin ? (
                <>
                  <div className="font-mono text-muted-foreground">
                    {pin[0].toFixed(5)}, {pin[1].toFixed(5)}
                  </div>
                  {reverseLoading ? (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" /> Looking up address…
                    </div>
                  ) : reverse ? (
                    <div className="text-foreground truncate">{reverse.full}</div>
                  ) : null}
                </>
              ) : (
                <div className="text-muted-foreground">No location selected yet.</div>
              )}
            </div>
            <a
              href={googleLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline shrink-0"
            >
              <ExternalLink size={12} /> Open in Google Maps
            </a>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!pin} className="bg-primary text-primary-foreground">
            <Check size={15} className="mr-1.5" /> Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}