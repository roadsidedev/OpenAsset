"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Plus, Menu, LogOut, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useTheme } from "@/components/ThemeProvider";
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
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const isReady = privyReady && !authLoading;

  const handleLogout = () => {
    backendLogout();
    privyLogout();
  };

  const NAV_ITEMS = [
    { label: "Markets", href: "/markets", icon: LayoutDashboard },
    { label: "Positions", href: "/positions", icon: Briefcase },
    { label: "Portfolio", href: "/portfolio", icon: LayoutDashboard },
  ];

  const renderAuthButton = (compact = false) => {
    if (!isReady) {
      return <div className={cn("animate-pulse rounded-2xl bg-muted", compact ? "h-8 w-16" : "h-9 w-28")} />;
    }
    if (!authenticated) {
      return (
        <Button
          onClick={() => login()}
          variant="secondary"
          className={cn("rounded-2xl font-medium", compact ? "h-8 px-3 text-xs" : "px-4 text-sm")}
        >
          Sign In
        </Button>
      );
    }
    if (!isBackendAuthenticated) {
      return (
        <Button
          onClick={() => signLoginMessage()}
          disabled={isSigning}
          className={cn(
            "rounded-2xl bg-ice-300 text-slate-900 hover:bg-ice-400 font-semibold",
            compact ? "h-8 px-3 text-xs" : "px-4 text-sm"
          )}
        >
          {isSigning ? "Signing..." : "Sign"}
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className={cn(
          "border border-border bg-muted/50 font-mono text-muted-foreground",
          compact ? "rounded-full px-2 py-1 text-[10px]" : "rounded-2xl px-3 py-1.5 text-xs"
        )}>
          {user?.wallet?.address?.slice(0, compact ? 4 : 6)}...{user?.wallet?.address?.slice(-4)}
        </span>
        <Button
          onClick={handleLogout}
          size="icon"
          variant="ghost"
          className={cn("text-muted-foreground hover:text-foreground", compact ? "h-7 w-7" : "h-8 w-8")}
        >
          <LogOut className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
        </Button>
      </div>
    );
  };

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

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Sign In / Wallet */}
            {renderAuthButton()}

            {/* Hamburger — far right, after sign-in */}
            <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </HamburgerMenu>
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
          {/* Sign In */}
          {renderAuthButton(true)}

          {/* Hamburger — far right */}
          <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </Button>
          </HamburgerMenu>
        </div>
      </header>

      {/* Mobile Bottom Nav — Twitter-style with FAB slot */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border glass md:hidden">
        <div className="flex h-16 items-stretch">
          {/* Nav item 1: Markets */}
          <Link
            href="/markets"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              pathname === "/markets" || pathname?.startsWith("/markets/")
                ? "text-ice-500 dark:text-ice-300"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            Markets
          </Link>

          {/* Nav item 2: Positions */}
          <Link
            href="/positions"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              pathname === "/positions"
                ? "text-ice-500 dark:text-ice-300"
                : "text-muted-foreground"
            )}
          >
            <Briefcase className="h-5 w-5" />
            Positions
          </Link>

          {/* Center FAB slot — Twitter-style elevated button */}
          <div className="flex flex-1 items-center justify-center">
            <Link
              href="/create-market"
              className={cn(
                "flex h-12 w-12 -mt-5 items-center justify-center rounded-full",
                "bg-ice-300 text-slate-900 shadow-lg shadow-ice-300/25",
                "transition-all duration-200 active:scale-90",
                "focus:outline-none"
              )}
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </Link>
          </div>

          {/* Nav item 3: Portfolio */}
          <Link
            href="/portfolio"
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              pathname === "/portfolio"
                ? "text-ice-500 dark:text-ice-300"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            Portfolio
          </Link>

          {/* Nav item 4: empty spacer for symmetry */}
          <div className="flex flex-1" />
        </div>
      </nav>
    </>
  );
}
