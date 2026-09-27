import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import {
  ChevronDown,
  LogOut,
  Building2,
  Mail,
  UserCog,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function initials(name, email) {
  const base = name || email || "";
  const parts = base.split(/[\s@._]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function UserMenu() {
  const { user, logout, checkUserAuth } = useAuth();
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!user) return null;

  const startEdit = () => {
    setCompany(user.company_name || "");
    setErr("");
    setEditing(true);
  };

  const saveCompany = async () => {
    const name = company.trim();
    if (!name) {
      setErr("Company name is required.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const found = await base44.entities.Company.filter({ name });
      const comp = found[0] || (await base44.entities.Company.create({ name }));
      await base44.auth.updateMe({
        company_id: comp.id,
        company_name: comp.name,
      });
      await checkUserAuth();
      setEditing(false);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Failed to save company.");
    } finally {
      setSaving(false);
    }
  };

  const roleBadge =
    user.role === "admin"
      ? "bg-primary/15 text-primary border-primary/40"
      : "bg-secondary text-muted-foreground border-border";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 hover:bg-secondary/70 transition pl-1 pr-2 py-1"
        >
          <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {initials(user.full_name, user.email)}
          </span>
          <span className="hidden sm:block text-xs font-medium max-w-[120px] truncate">
            {user.full_name || user.email}
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 bg-card border-border text-foreground"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">
                {user.full_name || "Account"}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${roleBadge}`}
              >
                <ShieldCheck size={10} /> {user.role}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <Mail size={12} /> {user.email}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary truncate">
              <Building2 size={12} /> {user.company_name || "No company set"}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {!editing ? (
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              startEdit();
            }}
          >
            <UserCog size={14} className="mr-2" />
            {user.company_name ? "Change company" : "Set company"}
          </DropdownMenuItem>
        ) : (
          <div className="px-2 py-2 space-y-2 outline-none" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-muted-foreground">Company name</span>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoFocus
              className="h-8 bg-background"
              placeholder="Your company"
            />
            {err && <p className="text-[11px] text-red-400">{err}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveCompany}
                disabled={saving}
                className="h-7 bg-primary text-primary-foreground"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
                className="h-7"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onSelect={() => logout()}
        >
          <LogOut size={14} className="mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}