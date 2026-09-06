"use client";

/**
 * @file ContactSheet.tsx
 * @description Support & feedback form, opened from the hamburger workspace
 * menu. Submits to the backend POST /support endpoint, which forwards the
 * request to support@openasset.markets. If the transport is unavailable
 * (delivered=false / request failed), falls back to a prefilled mailto: link
 * so the message always reaches the team.
 */

import { useState } from "react";
import { toast } from "sonner";
import { apiFetchJson } from "@/lib/apiClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EnvelopeSimple, CheckCircle } from "@phosphor-icons/react";

const SUPPORT_EMAIL = "support@openasset.markets";

const CATEGORIES = [
  { value: "support", label: "Support" },
  { value: "feedback", label: "Feedback" },
  { value: "bug", label: "Bug report" },
  { value: "other", label: "Something else" },
] as const;

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactSheet({ open, onOpenChange }: ContactSheetProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("support");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && message.trim().length >= 5;

  const mailtoFallback = () => {
    const subject = encodeURIComponent(`[${category.toUpperCase()}] OpenAsset contact form — ${email.trim()}`);
    const body = encodeURIComponent(
      [
        `Category: ${category}`,
        `From: ${name.trim() || "(no name)"} <${email.trim()}>`,
        `Page: ${typeof window !== "undefined" ? window.location.pathname : ""}`,
        "",
        message.trim(),
      ].join("\n"),
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const result = await apiFetchJson<{ delivered?: boolean }>("/support", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          message: message.trim(),
          page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });

      if (result?.delivered) {
        setSent(true);
        toast.success("Message sent — the team will get back to you soon.");
        return;
      }
      // Transport unavailable — hand off to the user's mail client so the
      // message still reaches support@openasset.markets.
      mailtoFallback();
      toast.info("Opening your email client to finish sending the message.");
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    onOpenChange(false);
    if (sent) {
      setName("");
      setEmail("");
      setMessage("");
      setCategory("support");
      setSent(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <SheetContent
        side="right"
        showCloseButton
        className="workspace-menu-panel workspace-menu-panel-right !inset-y-auto !bottom-auto !left-auto !right-4 !top-20 !h-auto !w-[min(420px,calc(100vw-2rem))] !max-w-none max-h-[calc(100vh-6rem)] rounded-[28px] border border-border/80 p-0 shadow-2xl shadow-black/20"
      >
        <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Contact the team</SheetTitle>
            <SheetDescription>Send feedback or a support request to support@openasset.markets</SheetDescription>
          </SheetHeader>

          {sent ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </span>
              <h2 className="text-lg font-bold text-foreground">Message on its way</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Thanks for reaching out — the team reads every message sent to {SUPPORT_EMAIL} and replies as soon as
                possible.
              </p>
              <Button onClick={close} variant="outline" className="mt-2 w-full rounded-2xl">
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="shrink-0 p-5 pb-3 space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ice-400/15 text-ice-600 dark:text-ice-300">
                    <EnvelopeSimple className="h-4.5 w-4.5" />
                  </span>
                  <h2 className="text-lg font-bold text-foreground">Contact the team</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Questions, feedback, or something broken? Messages go straight to {SUPPORT_EMAIL}.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="contact-name" className="text-xs font-semibold text-muted-foreground">
                      Name
                    </label>
                    <input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="contact-email" className="text-xs font-semibold text-muted-foreground">
                      Email *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-category" className="text-xs font-semibold text-muted-foreground">
                    Topic
                  </label>
                  <select
                    id="contact-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-muted/50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-message" className="text-xs font-semibold text-muted-foreground">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind — what worked, what didn't, what you'd like to see."
                    rows={6}
                    maxLength={5000}
                    className={cn(
                      "w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ice-400 placeholder:text-muted-foreground",
                    )}
                  />
                  <p className="text-right text-[10px] text-muted-foreground">{message.length}/5000</p>
                </div>
              </div>
              <div className="shrink-0 p-5 pt-3 border-t border-border bg-card">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !valid}
                  className="w-full rounded-2xl bg-ice-300 dark:bg-ice-400 text-slate-900 font-bold hover:bg-ice-400 dark:hover:bg-ice-300 disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send message"}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
