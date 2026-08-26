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
        "h-[52px] w-[52px] items-center justify-center rounded-full",
        "bg-foreground text-background shadow-[0_8px_20px_-8px_rgba(0,0,0,0.22)]",
        "transition-transform duration-200 hover:scale-[1.03] active-press",
        "focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2"
      )}
      title="Create market"
      aria-label="Create market"
    >
      <Plus className="h-5 w-5 stroke-[2.2]" />
    </Link>
  );
}
