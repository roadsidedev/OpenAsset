"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { CreateMarketFAB } from "@/components/CreateMarketFAB";
import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocs =
    pathname === "/docs" ||
    pathname?.startsWith("/docs/") ||
    pathname === "/doc" ||
    pathname?.startsWith("/doc/");

  if (isDocs) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="pb-16 md:pb-0">{children}</div>
      <CreateMarketFAB />

      <footer className="hidden border-t border-border bg-background/50 py-8 px-4 md:block">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/openasset-logo.png" alt="OpenAsset" width={20} height={20} />
            <span className="font-bold text-foreground">OpenAsset</span>
            <span>— Market Infrastructure</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/markets" className="hover:text-foreground transition-colors">Markets</Link>
            <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
            <Link href="/account" className="hover:text-foreground transition-colors">Account</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
