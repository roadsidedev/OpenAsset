"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Landing-page theme control. Matches cert-nav ghost chrome and shares the
 * same ThemeProvider / oa-theme persistence as the app Navbar.
 */
export function LandingThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="cert-theme-toggle"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="size-4" weight="bold" /> : <Moon className="size-4" weight="bold" />}
    </button>
  );
}
