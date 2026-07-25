"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Blocks, Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthApi } from "@/hooks/useAuthApi";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { useState } from "react";

export function Navbar() {
  const pathname = usePathname();
  const { login, logout: privyLogout, authenticated, ready: privyReady } = usePrivy();
  const {
    isAuthenticated: isBackendAuthenticated,
    signLoginMessage,
    isSigning,
    logout: backendLogout,
    user,
    isLoading: authLoading,
  } = useAuthApi();
  const [menuOpen, setMenuOpen] = useState(false);

  const isReady = privyReady && !authLoading;

  const handleConnect = () => {
    if (!authenticated) {
      login();
    } else if (!isBackendAuthenticated) {
      signLoginMessage();
    }
  };

  const handleLogout = () => {
    backendLogout();
    privyLogout();
  };

  const NAV_ITEMS = [
    { label: "Markets", href: "/markets" },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Adapters", href: "/adapters", icon: Blocks },
  ];

  return (
    <>
      {/* Desktop Top Nav */}
      <header className="sticky top-0 z-40 hidden border-b border-border glass md:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/markets" className="flex items-center gap-0.5 group focus:outline-none">
              <span className="text-2xl font-bold tracking-tighter text-ice-500 dark:text-ice-300 group-hover:scale-105 transition-transform">
                o
              </span>
              <span className="text-3xl font-extrabold tracking-tighter text-foreground group-hover:scale-105 transition-transform">
                A
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl transition-colors",
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                      ? "bg-primary text-primary-foreground font-bold"
                      : "hover:text-foreground hover:bg-accent"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </HamburgerMenu>

            {!isReady ? (
              <div className="h-9 w-28 animate-pulse rounded-2xl bg-muted" />
            ) : !authenticated ? (
              <Button onClick={login} variant="secondary" className="rounded-2xl px-4 text-sm font-medium">
                Connect Wallet
              </Button>
            ) : !isBackendAuthenticated ? (
              <Button
                onClick={signLoginMessage}
                disabled={isSigning}
                className="rounded-2xl bg-ice-300 text-slate-900 hover:bg-ice-400 px-4 text-sm font-semibold"
              >
                {isSigning ? "Signing..." : "Sign to Login"}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="rounded-2xl border border-border bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                  {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                </span>
                <Button
                  onClick={handleLogout}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Top Nav */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border glass px-4 md:hidden">
        <Link href="/markets" className="flex items-center gap-0.5">
          <span className="text-xl font-bold tracking-tighter text-ice-500 dark:text-ice-300">o</span>
          <span className="text-2xl font-extrabold tracking-tighter text-foreground">A</span>
        </Link>

        <div className="flex items-center gap-2">
          <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </HamburgerMenu>

          {!isReady ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
          ) : !authenticated ? (
            <Button onClick={login} size="sm" variant="secondary" className="rounded-full text-xs">
              Connect
            </Button>
          ) : !isBackendAuthenticated ? (
            <Button
              onClick={signLoginMessage}
              disabled={isSigning}
              size="sm"
              className="rounded-full bg-ice-300 text-slate-900 hover:bg-ice-400 text-xs font-semibold"
            >
              {isSigning ? "..." : "Sign"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-muted/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {user?.wallet?.address?.slice(0, 4)}...{user?.wallet?.address?.slice(-4)}
              </span>
              <Button onClick={handleLogout} size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border glass md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 text-[10px] font-medium transition-colors",
                  isActive ? "text-ice-500 dark:text-ice-300" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.icon ? (
                  <item.icon className="h-5 w-5" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
