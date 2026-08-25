"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function CreateMarketFAB() {
  const pathname = usePathname();

  // Hide on create-market page; mobile FAB is handled inside Navbar
  if (pathname === "/create-market") return null;

  return (
    <Link
      href="/create-market"
      className={cn(
        "fixed z-50 hidden md:flex",
        "bottom-6 right-6",
        "h-14 w-14 items-center justify-center rounded-full",
        "editorial-fab bg-ice-300 text-slate-900 shadow-glow",
        "transition-all duration-200 hover:bg-ice-400 active-press",
        "focus:outline-none focus:ring-2 focus:ring-ice-400 focus:ring-offset-2"
      )}
      title="Create Market"
    >
      <Plus className="h-6 w-6 stroke-[2.5]" />
    </Link>
  );
}
