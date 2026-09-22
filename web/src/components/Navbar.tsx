"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";import { SquaresFour, TrendUp, Briefcase, Plus, List, Sun, Moon, User, SignOut } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useTheme } from "@/components/ThemeProvider";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserIdentity, type UserIdentity } from "@/hooks/useUserIdentity";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { login, logout: privyLogout, ready: privyReady } = usePrivy();
  const {
    logout: backendLogout,
    isLoading: authLoading,
  } = useAuthApi();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const identity = useUserIdentity();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();

  // When Privy is not configured, privyReady is undefined — treat as ready
  // so the sign-in button is still functional via the fallback auth gate
  const isReady = privyReady !== false && !authLoading;

  /**
   * Real sign-out: clear the backend JWT, await Privy logout (its promise was
   * previously dropped — failures were silent and left `authenticated` true),
   * disconnect the wagmi connector (otherwise the persisted wagmi connection
   * keeps `session.isConnected` alive and the UI stays logged in), clear any
   * cached per-user queries, and leave protected pages.
   */
  const handleLogout = async () => {
    const wasProtected = pathname?.startsWith("/account") || pathname?.startsWith("/portfolio");
    backendLogout();
    try {
      await privyLogout();
    } catch (err) {
      console.error("Privy logout failed:", err);
    }
    disconnect();
    queryClient.clear();
    toast.success("Signed out");
    if (wasProtected) router.push("/");
  };

  const NAV_ITEMS = [
    { label: "Markets", href: "/markets", icon: SquaresFour },
    { label: "Earn", href: "/earn", icon: TrendUp },
    { label: "Portfolio", href: "/portfolio", icon: Briefcase },
    { label: "Account", href: "/account", icon: User },
  ];

  const MOBILE_NAV_ITEMS = [
    { label: "Markets", href: "/markets", icon: SquaresFour },
    { label: "Earn", href: "/earn", icon: TrendUp },
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
    if (!identity.authenticated) {
      return (
        <button
          type="button"
          onClick={handleLogin}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-medium transition-all active-press",
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm"
          )}
        >
          Sign In
        </button>
      );
    }
    // Signed in — show the user's avatar (social pfp or generated identicon)
    // with a compact account menu; sign-out lives inside it.
    return <ProfileMenu compact={compact} identity={identity} onLogout={handleLogout} />;
  };

  return (
    <>
      {/* Desktop Top Nav */}
      <header className="sticky top-0 z-40 hidden border-b border-border/70 glass md:block">
        <div className="mx-auto flex h-[56px] max-w-[1160px] items-center justify-between px-5 md:px-6">
          <div className="flex items-center gap-7">
            <Link href="/" className="flex items-center gap-2.5 group focus:outline-none" aria-label="OpenAsset — back to landing">
              <Image
                src="/openasset-logo.png"
                alt="OpenAsset Market"
                width={32}
                height={32}
                className="brand-logo"
              />
              <span className="text-[17px] font-semibold tracking-[-0.025em] text-foreground">
                OpenAsset
              </span>
            </Link>

            <nav className="flex items-center gap-1 text-[13.5px] font-medium text-muted-foreground">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 transition-colors",
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                      ? "bg-foreground text-background"
                      : "hover:bg-muted hover:text-foreground"
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
                <List className={cn("h-4.5 w-4.5 transition-premium", menuOpen && "rotate-90")} />
              </Button>
            </HamburgerMenu>
          </div>
        </div>
      </header>

      {/* Mobile Top Nav */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border glass px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-1">
          <HamburgerMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
            >
              <List className={cn("h-4 w-4 transition-premium", menuOpen && "rotate-90")} />
            </Button>
          </HamburgerMenu>

          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="OpenAsset — back to landing">
            <Image
              src="/openasset-logo.png"
              alt="OpenAsset Market"
              width={30}
              height={30}
              className="brand-logo shrink-0"
            />
            <span className="truncate text-lg font-bold tracking-tight text-foreground">
              OpenAsset
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
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
        </div>
      </header>

      {/* Mobile Bottom Nav — Twitter-style */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border glass md:hidden">
        <div className="grid grid-cols-4 h-14">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
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
          "transition-all duration-200 active-press",
          "focus:outline-none"
        )}
        title="Create Market"
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </Link>
    </>
  );
}

/**
 * Self-contained avatar + account menu. Rendered once per navbar breakpoint
 * (desktop + mobile headers are both in the DOM), so each instance owns its
 * open state and outside-click ref — sharing one ref/state across copies
 * caused the visible menu to close on mousedown before the click landed,
 * which made "Your account" and "Sign out" appear dead.
 */
function ProfileMenu({
  compact = false,
  identity,
  onLogout,
}: {
  compact?: boolean;
  identity: UserIdentity;
  onLogout: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / touch / Escape.
  useEffect(() => {
    if (!open) return;
    const onOutside = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const avatarSize = compact ? "h-8 w-8" : "h-9 w-9";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className={cn(
          "block overflow-hidden rounded-full ring-1 ring-border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-400 hover:ring-ice-400/60",
          avatarSize,
        )}
      >
        <UserAvatar
          address={identity.address}
          avatarUrl={identity.avatarUrl}
          alt={identity.displayName ?? "Your profile"}
          className={avatarSize}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/10 space-y-3"
        >
          <div className="flex items-center gap-3">
            <UserAvatar
              address={identity.address}
              avatarUrl={identity.avatarUrl}
              alt={identity.displayName ?? "Your profile"}
              className="h-11 w-11 rounded-full shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {identity.displayName ?? "OpenAsset user"}
              </p>
              {identity.address && (
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {identity.address.slice(0, 6)}…{identity.address.slice(-4)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/account");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-muted"
          >
            <User className="h-4 w-4 text-muted-foreground" />
            Your account
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <SignOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
