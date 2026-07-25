"use client";

import Link from "next/link";
import {
  BookOpen,
  Blocks,
  Mail,
  Info,
  Github,
  Sun,
  Moon,
  ExternalLink,
  X,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface HamburgerMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MENU_ITEMS = [
  { label: "Docs", href: "/docs", icon: BookOpen },
  { label: "Adapter Registry", href: "/adapters", icon: Blocks },
  { label: "About", href: "/about", icon: Info },
  { label: "Contact", href: "mailto:team@openasset.io", icon: Mail, external: true },
  { label: "GitHub", href: "https://github.com/openasset-market", icon: Github, external: true },
];

export function HamburgerMenu({ children, open, onOpenChange }: HamburgerMenuProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-[280px] p-0 glass border-l border-border"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle className="text-base font-bold">Menu</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => onOpenChange?.(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.external && (
                      <ExternalLink className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border px-6 py-4">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
