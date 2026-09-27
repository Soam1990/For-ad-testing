import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarDays, Layers, Settings, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function LeftNav() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "company_admin";

  const baseItems = [
    { icon: LayoutGrid, label: "Home", to: "/" },
    { icon: CalendarDays, label: "Schedule", to: "/schedule" },
  ];
  const adminItems = [
    { icon: Layers, label: "Clients", to: "/clients" },
    { icon: ClipboardList, label: "Approvals", to: "/approvals" },
    { icon: Settings, label: "Admin", to: "/admin" },
  ];
  const navItems = [...baseItems, ...(isAdmin ? adminItems : [])];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 flex-col items-center gap-1.5 border-r border-border bg-card z-30 py-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold text-lg shadow-lg shadow-primary/20">
        A
      </div>
      {navItems.map(({ icon: Icon, label, to }) => (
        <NavLink
          key={label}
          to={to}
          title={label}
          end={to === "/"}
          className={({ isActive }) =>
            `relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={1.75} />
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r bg-primary" />
              )}
            </>
          )}
        </NavLink>
      ))}
      <div className="mt-auto h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
        AM
      </div>
    </aside>
  );
}