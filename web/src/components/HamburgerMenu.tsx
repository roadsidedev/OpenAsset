"use client";

import Link from "next/link";
import { useState, type ElementType } from "react";
import {
  ArrowSquareOut,
  BookOpen,
  Envelope,
  GithubLogo,
  PuzzlePiece,
  XLogo,
} from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContactSheet } from "@/components/ContactSheet";

interface HamburgerMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface MenuItem {
  label: string;
  description: string;
  href?: string;
  icon: ElementType;
  external?: boolean;
  /** Opens the contact form sheet instead of navigating. */
  action?: "contact";
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Docs", description: "Protocol guides", href: "/docs", icon: BookOpen },
  { label: "Adapter Registry", description: "Explore integrations", href: "/adapters", icon: PuzzlePiece },
  { label: "X (Twitter)", description: "@openassetmarket", href: "https://x.com/openassetmarket", icon: XLogo, external: true },
  { label: "GitHub", description: "View the source", href: "https://github.com/openasset-market", icon: GithubLogo, external: true },
  { label: "Contact & Support", description: "Feedback, questions, help", icon: Envelope, action: "contact" },
];

export function HamburgerMenu({ children, open, onOpenChange }: HamburgerMenuProps) {
  const [contactOpen, setContactOpen] = useState(false);

  const renderRow = (item: MenuItem) => {
    const Icon = item.icon;

    if (item.action === "contact") {
      return (
        <button
          key={item.label}
          type="button"
          className="workspace-menu-item group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-muted-foreground"
          onClick={() => {
            onOpenChange?.(false);
            setContactOpen(true);
          }}
        >
          <span className="workspace-menu-icon flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/30 text-foreground/80">
            <Icon className="size-[17px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground/90">{item.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
          </span>
          <span className="workspace-menu-arrow shrink-0 text-sm opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70" aria-hidden="true">
            →
          </span>
        </button>
      );
    }

    return (
      <Link
        key={item.label}
        href={item.href ?? "#"}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        className="workspace-menu-item group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-muted-foreground"
        onClick={() => onOpenChange?.(false)}
      >
        <span className="workspace-menu-icon flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/30 text-foreground/80">
          <Icon className="size-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-foreground/90">{item.label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
        </span>
        {item.external ? (
          <ArrowSquareOut className="size-4 shrink-0 opacity-35 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-75" />
        ) : (
          <span className="workspace-menu-arrow shrink-0 text-sm opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-70" aria-hidden="true">
            →
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{children}</SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton
          className="workspace-menu-panel workspace-menu-panel-right !inset-y-auto !bottom-auto !left-auto !right-4 !top-20 !h-auto !w-[min(360px,calc(100vw-2rem))] !max-w-none max-h-[calc(100vh-6rem)] rounded-[28px] border border-border/80 p-0 shadow-2xl shadow-black/20"
        >
          <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden">
            <SheetHeader className="workspace-menu-header border-b border-border/60 px-5 pb-4 pt-5 pr-14 text-left">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-ice-400 shadow-[0_0_12px_rgba(168,216,255,0.75)]" />
                OpenAsset workspace
              </div>
              <SheetTitle className="mt-2 font-serif text-xl tracking-tight text-foreground">Explore the protocol</SheetTitle>
              <SheetDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Reference, integrations, and the people building permissionless markets.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="workspace-menu-list space-y-1">{MENU_ITEMS.map(renderRow)}</div>
            </div>

            <div className="workspace-menu-footer flex items-center justify-between border-t border-border/60 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Permissionless infrastructure</span>
              <span className="text-ice-500/80 dark:text-ice-300/80">OpenAsset</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ContactSheet open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
}
