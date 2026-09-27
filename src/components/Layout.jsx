import React from "react";
import { Outlet } from "react-router-dom";
import LeftNav from "@/components/LeftNav";
import MobileNav from "@/components/MobileNav";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LeftNav />
      <main className="md:pl-16 pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}