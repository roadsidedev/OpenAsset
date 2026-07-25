"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function CreateMarketFAB() {
  const pathname = usePathname();

  // Hide on create-market page
  if (pathname === "/create-market") return null;

  return (
    <>
      {/* Desktop FAB — bottom-right */}
      <Link
        href="/create-market"
        className={cn(
          "fixed bottom-6 right-6 z-50 hidden md:flex",
          "h-14 w-14 items-center justify-center rounded-full",
          "bg-ice-300 text-slate-900 shadow-glow",
          "transition-all duration-200 hover:scale-105 hover:bg-ice-400 active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-ice-400 focus:ring-offset-2"
        )}
        title="Create Market"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </Link>

      {/* Mobile FAB — centered in bottom nav */}
      <Link
        href="/create-market"
        className={cn(
          "fixed bottom-4 left-1/2 z-50 md:hidden",
          "flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full",
          "bg-ice-300 text-slate-900 shadow-glow",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          "focus:outline-none focus:ring-2 focus:ring-ice-400 focus:ring-offset-2"
        )}
        title="Create Market"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </Link>
    </>
  );
}
