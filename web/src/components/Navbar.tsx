"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Plus, Menu, LogOut, Sun, Moon, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useTheme } from "@/components/ThemeProvider";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { useState } from "react";
import Image from "next/image";

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

  // When Privy is not configured, privyReady is undefined — treat as ready
  // so the sign-in button is still functional via the fallback auth gate
  const isReady = privyReady !== false && !authLoading;

  const handleLogout = () => {
    backendLogout();
    privyLogout();
  };

  const NAV_ITEMS = [
    { label: "Markets", href: "/markets", icon: LayoutDashboard },
    { label: "Portfolio", href: "/portfolio", icon: Briefcase },
    { label: "Account", href: "/account", icon: User },
  ];

  const MOBILE_NAV_ITEMS = [
    { label: "Markets", href: "/markets", icon: LayoutDashboard },
    { label: "Portfolio", href: "/portfolio", icon: Briefcase },
    { label: "Account", href: "/account", icon: User },
  ];

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      console.error("Privy login failed:", err);
    }
  };

  const renderAuthButton = (compact = false) => {
    if (!isReady) {
      return <div className={cn("animate-pulse rounded-2xl bg-muted", compact ? "h-8 w-16" : "h-9 w-28")} />;
    }
    if (!authenticated) {
      return (
        <button
          type="button"
          onClick={handleLogin}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium transition-all",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
          )}
        >
          Sign In
        </button>
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
            <Link href="/markets" className="flex items-center gap-2 group focus:outline-none">
              <Image
                src="/openasset-logo.png"
                alt="OpenAsset Market"
                width={36}
                height={36}
                className="group-hover:scale-105 transition-transform"
              />
              <span className="text-xl font-bold tracking-tight text-foreground group-hover:scale-105 transition-transform">
                OpenAsset
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
            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {renderAuthButton()}

            <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <Menu className="h-4.5 w-4.5" />
              </Button>
            </HamburgerMenu>
          </div>
        </div>
      </header>

      {/* Mobile Top Nav */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border glass px-4 md:hidden">
        <Link href="/markets" className="flex items-center gap-2">
          <Image
            src="/openasset-logo.png"
            alt="OpenAsset Market"
            width={30}
            height={30}
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            OpenAsset
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Theme Toggle — visible on mobile */}
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {renderAuthButton(true)}

          <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Menu className="h-4 w-4" />
            </Button>
          </HamburgerMenu>
        </div>
      </header>

      {/* Mobile Bottom Nav — Twitter-style */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border glass md:hidden">
        <div className="grid grid-cols-3 h-14">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-ice-500 dark:text-ice-300" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile FAB — Twitter-style bottom-right */}
      <Link
        href="/create-market"
        className={cn(
          "fixed z-50 md:hidden",
          "right-4 bottom-[4.5rem]",
          "flex h-14 w-14 items-center justify-center rounded-full",
          "bg-ice-300 text-slate-900 shadow-lg shadow-ice-300/25",
          "transition-all duration-200 active:scale-90",
          "focus:outline-none"
        )}
        title="Create Market"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </Link>
    </>
  );
}
