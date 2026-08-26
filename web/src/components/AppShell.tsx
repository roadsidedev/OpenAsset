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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-2xl focus:bg-ice-300 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-900"
      >
        Skip to content
      </a>
      <Navbar />
      <div className="pb-16 md:pb-0">
        <main id="main-content">{children}</main>
      </div>
      <CreateMarketFAB />

      <footer className="hidden border-t border-border/60 bg-card/40 px-5 py-6 md:block md:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col items-center justify-between gap-3 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Image src="/openasset-logo.png" alt="OpenAsset" width={18} height={18} className="brand-logo opacity-90" />
            <span className="font-semibold tracking-tight text-foreground">OpenAsset</span>
            <span className="opacity-70">— Market infrastructure</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/markets" className="hover:text-foreground transition-colors">Markets</Link>
            <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
            <Link href="/account" className="hover:text-foreground transition-colors">Account</Link>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
