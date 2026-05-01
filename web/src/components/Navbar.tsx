"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, PlusCircle, Wallet, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthApi } from "@/hooks/useAuthApi";

export function Navbar() {
  const pathname = usePathname();
  const { login, logout: privyLogout, authenticated, ready: privyReady } = usePrivy();
  const { isAuthenticated: isBackendAuthenticated, signLoginMessage, isSigning, logout: backendLogout, user, isLoading: authLoading } = useAuthApi();
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
    {
      label: "Markets",
      href: "/markets",
      icon: Home,
    },
    {
      label: "Create",
      href: "/create-market",
      icon: PlusCircle,
    },
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <>
      {/* Mobile Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-black/90 backdrop-blur-lg px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-red-600"></div>
          <span className="text-xl font-bold tracking-tight text-white">Red Chips</span>
        </Link>
        <div className="flex items-center gap-2">
          {!isReady ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-800" />
          ) : !authenticated ? (
            <Button onClick={login} size="sm" variant="secondary" className="rounded-full">
              Connect
            </Button>
          ) : !isBackendAuthenticated ? (
            <Button
              onClick={signLoginMessage}
              disabled={isSigning}
              variant="default"
              size="sm"
              className="rounded-full bg-red-600 hover:bg-red-700"
            >
              {isSigning ? "..." : "Sign"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                {user?.wallet?.address?.slice(0, 4)}...{user?.wallet?.address?.slice(-4)}
              </div>
              <Button onClick={handleLogout} size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Desktop Top Nav */}
      <nav className="sticky top-0 z-50 hidden border-b border-white/10 bg-black/50 backdrop-blur-md md:block">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 bg-red-600 rounded-full"></div>
            <span className="text-xl font-bold tracking-tight text-white">Red Chips</span>
          </Link>
          <div className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-white",
                  pathname === item.href ? "text-white" : "text-zinc-400"
                )}
              >
                {item.label}
              </Link>
            ))}
            
            {!isReady ? (
              <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-800" />
            ) : !authenticated ? (
              <Button onClick={login} variant="secondary" className="rounded-full">
                Connect Wallet
              </Button>
            ) : !isBackendAuthenticated ? (
              <Button
                onClick={signLoginMessage}
                disabled={isSigning}
                variant="default"
                className="rounded-full bg-red-600 hover:bg-red-700"
              >
                {isSigning ? "Signing..." : "Sign to Login"}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-400 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                </div>
                <Button onClick={handleLogout} size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/90 backdrop-blur-lg md:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 p-2 text-xs font-medium transition-colors",
                  isActive ? "text-red-500" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}

        </div>
      </nav>
    </>
  );
}
