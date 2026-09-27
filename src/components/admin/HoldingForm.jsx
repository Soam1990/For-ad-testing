import React, { useState, useRef, useEffect } from "react";
import { Upload, ImagePlus, Save, X, Building2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Image } from "@/components/ui/image";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import MapPickerModal from "@/components/MapPickerModal";

const TYPES = ["Billboard", "Digital Screen", "Transit"];

const EMPTY = {
  site_code: "",
  name: "",
  type: "Billboard",
  city: "",
  address: "",
  lat: "",
  lng: "",
  dimensions: "",
  daily_impressions: "",
  description: "",
  image_url: "",
};

const normalizeHolding = (h) => ({
  site_code: h.site_code || "",
  name: h.name || "",
  type: h.type || "Billboard",
  city: h.city || "",
  address: h.address || "",
  lat: h.lat != null ? String(h.lat) : "",
  lng: h.lng != null ? String(h.lng) : "",
  dimensions: h.dimensions || "",
  daily_impressions: h.daily_impressions != null ? String(h.daily_impressions) : "",
  description: h.description || "",
  image_url: h.image_url || "",
  company_id: h.company_id || "",
});

export default function HoldingForm({ holding, onSaved, user, companies = [], defaultCompanyId = "" }) {
  const isCompanyAdmin = user?.role === "company_admin";
  const fixedCompanyId = isCompanyAdmin ? user.company_id : null;
  const fixedCompanyName = isCompanyAdmin ? user.company_name : null;

  const [form, setForm] = useState(() =>
    holding
      ? { ...EMPTY, ...normalizeHolding(holding) }
      : { ...EMPTY, company_id: defaultCompanyId || "" }
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(holding ? { ...EMPTY, ...normalizeHolding(holding) } : { ...EMPTY, company_id: defaultCompanyId || "" });
  }, [holding?.id, defaultCompanyId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("image_url", file_url);
    } catch (err) {
      setError("Image upload failed. " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const companyId = fixedCompanyId || form.company_id || "";
  const companyName =
    fixedCompanyName ||
    companies.find((c) => c.id === form.company_id)?.name ||
    holding?.company_name ||
    "";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.site_code || !form.name || !form.city) {
      setError("Site code, name and city are required.");
      return;
    }
    if (!companyId) {
      setError("Please select a company that owns this holding.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        site_code: form.site_code.trim(),
        name: form.name.trim(),
        type: form.type,
        city: form.city.trim(),
        address: form.address.trim(),
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        dimensions: form.dimensions.trim(),
        daily_impressions: form.daily_impressions ? Number(form.daily_impressions) : undefined,
        description: form.description.trim() || undefined,
        image_url: form.image_url || undefined,
        company_id: companyId,
        company_name: companyName,
      };
      if (holding?.id) {
        await base44.entities.Holding.update(holding.id, payload);
      } else {
        await base44.entities.Holding.create({ ...payload, status: "available" });
        setForm(EMPTY);
        if (fileRef.current) fileRef.current.value = "";
      }
      onSaved?.();
    } catch (err) {
      setError("Failed to save holding. " + (err?.response?.data?.error || err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Image uploader */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Display Photo
        </Label>
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary/40">
            {form.image_url ? (
              <Image src={form.image_url} alt="preview" className="h-full w-full" fittingType="fill" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <ImagePlus size={22} />
              </div>
            )}
            {form.image_url && (
              <button
                type="button"
                onClick={() => set("image_url", "")}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
              id="holding-image"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={15} className="mr-1.5" />
              {uploading ? "Uploading…" : form.image_url ? "Replace photo" : "Upload photo"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              JPG or PNG. Used on cards and the inspector map.
            </p>
          </div>
        </div>
      </div>

      {/* Company ownership */}
      {isCompanyAdmin ? (
        <div className="rounded-md border border-border bg-secondary/20 px-3 py-2 flex items-center gap-2 text-xs">
          <Building2 size={13} className="text-primary" />
          <span className="text-muted-foreground">Inventory owner:</span>
          <span className="font-medium">{fixedCompanyName}</span>
        </div>
      ) : (
        <Field label="Owning company *">
          <Select
            value={form.company_id || ""}
            onValueChange={(v) => set("company_id", v)}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Site Code *">
          <Input
            value={form.site_code}
            onChange={(e) => set("site_code", e.target.value)}
            placeholder="TOR-003"
          />
        </Field>
        <Field label="Name *">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Front Street Digital Panel"
          />
        </Field>
        <Field label="Type">
          <Select value={form.type} onValueChange={(v) => set("type", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="City *">
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Toronto"
          />
        </Field>
        <Field label="Address" className="col-span-1 sm:col-span-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => set("address", v)}
                onSelect={(p) => {
                  if (p.address) set("address", p.address);
                  if (p.city && !form.city) set("city", p.city);
                  if (p.lat != null) set("lat", String(p.lat));
                  if (p.lng != null) set("lng", String(p.lng));
                }}
                placeholder="Search an address — city, street…"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 sm:self-start"
              title="Pick location on a map"
            >
              <MapPin size={15} className="mr-1.5" /> Pick on map
            </Button>
          </div>
        </Field>
        <Field label="Description" className="col-span-2">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Describe the holding — visibility, orientation, traffic, notes…"
            rows={3}
            className="bg-background resize-y"
          />
        </Field>
        <Field label="Dimensions">
          <Input
            value={form.dimensions}
            onChange={(e) => set("dimensions", e.target.value)}
            placeholder="10m × 6m"
          />
        </Field>
        <Field label="Daily Impressions">
          <Input
            type="number"
            value={form.daily_impressions}
            onChange={(e) => set("daily_impressions", e.target.value)}
            placeholder="120000"
          />
        </Field>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Save size={16} className="mr-1.5" />
        {saving ? "Saving…" : holding?.id ? "Update Holding" : "Create Holding"}
      </Button>

      <MapPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={{ lat: form.lat, lng: form.lng, address: form.address, city: form.city }}
        onConfirm={(p) => {
          if (p.lat != null) set("lat", String(p.lat));
          if (p.lng != null) set("lng", String(p.lng));
          if (p.address) set("address", p.address);
          if (p.city) set("city", p.city);
        }}
      />
    </form>
  );
}

function Field({ label, className, children }) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}