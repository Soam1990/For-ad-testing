import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, CalendarDays, ClipboardList, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function MobileNav() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "company_admin";

  const items = [
    { icon: LayoutGrid, label: "Home", to: "/" },
    { icon: CalendarDays, label: "Schedule", to: "/schedule" },
    ...(isAdmin
      ? [
          { icon: ClipboardList, label: "Approvals", to: "/approvals" },
          { icon: Users, label: "Clients", to: "/clients" },
        ]
      : []),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={1.75} />
                <span className="truncate max-w-full px-1">{label}</span>
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-primary" />}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}