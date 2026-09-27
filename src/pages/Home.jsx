import React from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  CalendarRange,
  LayoutDashboard,
  ArrowRight } from
"lucide-react";
import { useAuth } from "@/lib/AuthContext";
import UserMenu from "@/components/UserMenu";

export default function Home() {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "company_admin";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center gap-3">
        <LayoutDashboard size={20} className="text-primary shrink-0" />
        <h1 className="font-display font-bold text-base sm:text-xl min-w-0 truncate">
          AnyaAd — Powered by SOAM Solutions
        </h1>
        <span className="text-sm text-muted-foreground hidden lg:inline">
          · Billboard & screen booking portal
        </span>
        <div className="ml-auto shrink-0">
          <UserMenu />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <section className="space-y-3">
          <h2 className="font-display font-bold text-3xl sm:text-4xl">
            Welcome{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}.
          </h2>
          <p className="text-muted-foreground max-w-2xl">
            {isStaff ?
            "Manage your inventory, review booking requests, and share your public booking link from the admin portal." :
            "Browse available inventory and request reservations through a company's booking link."}
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          {isStaff ?
          <>
              <QuickLink
              to="/admin"
              icon={Building2}
              title="Admin portal"
              desc="Create inventory, manage holdings, and get your public booking link." />
            
              <QuickLink
              to="/approvals"
              icon={ClipboardList}
              title="Booking requests"
              desc="Review and confirm pending reservation requests." />
            
            </> :

          <div className="rounded-xl border border-border bg-card p-6 sm:col-span-2 space-y-2">
              <CalendarRange size={22} className="text-primary" />
              <h3 className="font-display font-semibold text-lg">No public inventory here</h3>
              <p className="text-sm text-muted-foreground">
                Reservations are made through a company's private booking link. If you have
                one, open it to view available billboards and request a reservation.
              </p>
            </div>
          }
        </section>
      </main>
    </div>);

}

function QuickLink({ to, icon: Icon, title, desc }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition flex items-start gap-4">
      
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display font-semibold text-lg">{title}</h3>
          <ArrowRight
            size={15}
            className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
          
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </Link>);

}