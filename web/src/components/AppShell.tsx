"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocs = pathname === "/docs" || pathname?.startsWith("/docs/") || pathname === "/doc" || pathname?.startsWith("/doc/");

  if (isDocs) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pb-20 md:pb-0">{children}</div>
    </>
  );
}
