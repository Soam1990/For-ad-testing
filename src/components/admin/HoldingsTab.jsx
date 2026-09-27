import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Pencil, Trash2, Building2, Loader2, MapPin, Ruler, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HoldingForm from "./HoldingForm";

const typeGradients = {
  Billboard: "from-cyan-500/25 to-blue-700/10",
  "Digital Screen": "from-fuchsia-500/25 to-cyan-500/10",
  Transit: "from-amber-500/25 to-rose-500/10",
};

export default function HoldingsTab() {
  const { user } = useAuth();
  const isCompanyAdmin = user?.role === "company_admin";
  const [holdings, setHoldings] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [hs, comps] = await Promise.all([
        base44.entities.Holding.list("-created_date", 200),
        base44.entities.Company.list("-created_date", 100),
      ]);
      const visible = isCompanyAdmin
        ? hs.filter((h) => h.company_id === user.company_id)
        : hs;
      setHoldings(visible);
      setCompanies(comps);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load holdings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (h) => {
    if (!window.confirm(`Delete holding "${h.name}"? This cannot be undone.`)) return;
    setDeleting(h.id);
    setError("");
    try {
      await base44.entities.Holding.delete(h.id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-primary" />
          <h2 className="font-display font-semibold text-lg">
            {isCompanyAdmin ? "Add holding to your inventory" : "Add New Holding"}
          </h2>
        </div>
        <HoldingForm user={user} companies={companies} onSaved={load} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <Building2 size={16} className="text-muted-foreground" />
            {isCompanyAdmin ? "Your Inventory" : "Current Holdings"}
          </h2>
          <span className="text-xs text-muted-foreground">{holdings.length} total</span>
        </div>
        {loading ? (
          <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
        ) : holdings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holdings yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {holdings.map((h) => {
              const gradient = typeGradients[h.type] ?? "from-cyan-500/20 to-slate-700/10";
              const available = h.status !== "booked";
              return (
                <div
                  key={h.id}
                  className="rounded-xl border border-border bg-card overflow-hidden flex flex-col"
                >
                  <div className="relative h-32 overflow-hidden">
                    {h.image_url ? (
                      <Image
                        src={h.image_url}
                        alt={h.name}
                        className="h-full w-full"
                        fittingType="fill"
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br ${gradient}`} />
                    )}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-medium text-white ${
                        available ? "bg-emerald-500/90" : "bg-red-500/90"
                      }`}
                    >
                      {available ? "Available" : "Booked"}
                    </span>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-[11px] text-white backdrop-blur-sm">
                      {h.type}
                    </span>
                  </div>
                  <div className="p-3 space-y-2 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-primary font-medium">
                      {h.site_code}
                    </div>
                    <div className="font-medium text-sm truncate">{h.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin size={12} /> {h.city}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                      <span className="flex items-center gap-1">
                        <Ruler size={12} /> {h.dimensions || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} /> {(h.daily_impressions || 0).toLocaleString()}/d
                      </span>
                    </div>
                    {!isCompanyAdmin && h.company_name && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {h.company_name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 px-3 pb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditTarget(h)}
                      className="h-8 flex-1"
                    >
                      <Pencil size={13} className="mr-1" /> Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(h)}
                      disabled={deleting === h.id}
                      className="h-8 w-8 text-red-400 hover:bg-red-500/10"
                      title="Delete"
                    >
                      {deleting === h.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil size={18} className="text-primary" /> Edit Holding
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <HoldingForm
              holding={editTarget}
              user={user}
              companies={companies}
              onSaved={() => {
                setEditTarget(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}