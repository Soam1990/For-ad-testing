import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Loader2,
  Building2,
  ClipboardList,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import UserMenu from "@/components/UserMenu";
import InventoryDashboard from "@/components/admin/InventoryDashboard";
import ReservationApprovals from "@/components/admin/ReservationApprovals";
import UsersTab from "@/components/admin/UsersTab";
import CompaniesTab from "@/components/admin/CompaniesTab";
import InventoryCalendar from "@/components/admin/InventoryCalendar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

const BASE_TABS = [
  { id: "holdings", label: "Inventory", icon: Building2 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "bookings", label: "Booking Requests", icon: ClipboardList },
];

export default function Admin() {
  const { user, isLoadingAuth } = useAuth();
  const isGlobalAdmin = user?.role === "admin";
  const isCompanyAdmin = user?.role === "company_admin";
  const canAccess = isGlobalAdmin || isCompanyAdmin;
  const [tab, setTab] = useState("holdings");
  const [copied, setCopied] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  useEffect(() => {
    if (!isGlobalAdmin) return;
    base44.entities.Company.list("-created_date", 200)
      .then(setCompanies)
      .catch(() => {});
  }, [isGlobalAdmin]);

  const activeCompanyId = isGlobalAdmin ? selectedCompanyId : user?.company_id || "";

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center h-screen px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-500/15 flex items-center justify-center">
            <Lock size={26} className="text-red-400" />
          </div>
          <h1 className="font-display text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Only company admins or global admins can access the admin portal.
          </p>
        </div>
      </div>
    );
  }

  const tabs = isGlobalAdmin
    ? [
        ...BASE_TABS,
        { id: "users", label: "User Rights", icon: Users },
        { id: "companies", label: "Companies", icon: Building2 },
      ]
    : BASE_TABS;

  const bookingLink =
    isCompanyAdmin && user?.company_id
      ? `${window.location.origin}/book/${user.company_id}`
      : null;

  const copyLink = async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
        <ShieldCheck size={20} className="text-primary shrink-0" />
        <h1 className="font-display font-bold text-lg sm:text-2xl">Admin Portal</h1>
        {isCompanyAdmin && user?.company_name && (
          <span className="text-sm text-muted-foreground hidden sm:inline">· {user.company_name}</span>
        )}
        {isGlobalAdmin && (
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-full sm:w-[220px] sm:ml-2 bg-background border-border">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto shrink-0">
          <UserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {bookingLink && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <LinkIcon size={16} className="text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Your public booking link</div>
              <div className="text-xs text-muted-foreground truncate font-mono">
                {bookingLink}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink} className="shrink-0">
              {copied ? <Check size={13} className="mr-1" /> : <Copy size={13} className="mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "holdings" && <InventoryDashboard companyId={activeCompanyId} companies={companies} />}
        {tab === "calendar" && <InventoryCalendar />}
        {tab === "bookings" && <ReservationApprovals />}
        {tab === "users" && isGlobalAdmin && <UsersTab companyId={activeCompanyId} />}
        {tab === "companies" && isGlobalAdmin && <CompaniesTab />}
      </div>
    </div>
  );
}