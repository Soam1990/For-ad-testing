import React, { useEffect, useState } from "react";
import { Building2, Pencil, Trash2, Plus, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const comps = await base44.entities.Company.list("-created_date", 200);
      setCompanies(comps);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load companies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveEdit = async () => {
    const c = editTarget;
    const name = editName.trim();
    if (!c || !name) return;
    setBusy(c.id);
    setError("");
    try {
      await base44.entities.Company.update(c.id, { name });
      setEditTarget(null);
      setEditName("");
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to rename company.");
    } finally {
      setBusy(null);
    }
  };

  const createCompany = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy("new");
    setError("");
    try {
      await base44.entities.Company.create({ name });
      setNewName("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to create company.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    const c = deleteTarget;
    if (!c) return;
    setBusy(c.id);
    setError("");
    try {
      await base44.entities.Company.delete(c.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to delete company.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Rename or delete any company. Deleting a company does not delete its billboards or
          users — they remain but lose their company association.
        </p>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={14} className="mr-1" /> New Company
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/15 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-8 w-8 mx-auto border-4 border-secondary border-t-primary rounded-full animate-spin" />
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No companies yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Company Name</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-3 py-2 flex items-center gap-2">
                    <Building2 size={14} className="text-primary" />
                    {c.name}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {busy === c.id ? (
                      <Loader2 size={14} className="animate-spin inline" />
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditTarget(c);
                            setEditName(c.name);
                          }}
                          className="h-7 px-2"
                        >
                          <Pencil size={13} className="mr-1" /> Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(c)}
                          className="h-7 px-2 ml-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={13} className="mr-1" /> Delete
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil size={16} className="text-primary" /> Rename company
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-background"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={saveEdit}
              disabled={busy === editTarget?.id || !editName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy === editTarget?.id ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" /> Delete company
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <p className="text-sm">
              Delete <span className="font-medium">{deleteTarget?.name}</span>? This cannot be
              undone.
            </p>
            <p className="text-xs text-muted-foreground">
              Its billboards and users will remain in the system but will no longer be linked to
              this company.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              onClick={confirmDelete}
              disabled={busy === deleteTarget?.id}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {busy === deleteTarget?.id ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Plus size={16} className="text-primary" /> New company
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name"
              className="bg-background"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={createCompany}
              disabled={busy === "new" || !newName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy === "new" ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}