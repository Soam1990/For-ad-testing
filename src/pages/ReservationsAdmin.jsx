import React from "react";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import UserMenu from "@/components/UserMenu";
import ReservationApprovals from "@/components/admin/ReservationApprovals";

export default function ReservationsAdmin() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (user.role !== "admin" && user.role !== "company_admin")) {
    return (
      <div className="flex items-center justify-center h-screen px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-red-500/15 flex items-center justify-center">
            <Lock size={26} className="text-red-400" />
          </div>
          <h1 className="font-display text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Only company admins or global admins can review and approve reservations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center gap-3">
        <ShieldCheck size={20} className="text-primary shrink-0" />
        <h1 className="font-display font-bold text-lg sm:text-2xl min-w-0 truncate">
          Admin — Approvals
        </h1>
        <div className="ml-auto shrink-0">
          <UserMenu />
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <ReservationApprovals />
      </div>
    </div>
  );
}