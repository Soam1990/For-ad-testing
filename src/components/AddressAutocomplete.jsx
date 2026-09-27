import React, { useState, useRef, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

// Parses a Nominatim address object into { address, city }
function parsePlace(p) {
  const a = p.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || a.state || "";
  const fullAddress = p.display_name ? p.display_name.split(", ").slice(0, 2).join(", ") : street;
  return {
    address: street || fullAddress,
    city,
    lat: p.lat,
    lng: p.lon,
    raw: p.display_name,
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className = "",
}) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = (q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `${NOMINATIM}?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setActive(-1);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleType = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange?.(v);
    runSearch(v);
  };

  const choose = (p) => {
    const parsed = parsePlace(p);
    setQuery(parsed.raw || parsed.address);
    setOpen(false);
    setResults([]);
    onSelect?.(parsed);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={query}
        onChange={handleType}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto scrollbar-thin">
          {results.map((p, i) => {
            const parsed = parsePlace(p);
            return (
              <li key={p.place_id || i}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 ${
                    active === i ? "bg-primary/15 text-primary" : "hover:bg-secondary/40"
                  }`}
                >
                  <MapPin size={13} className="mt-0.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{parsed.raw}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}