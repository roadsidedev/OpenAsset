"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("oa-theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial: Theme = prefersDark ? "dark" : "light";
      setThemeState(initial);
      document.documentElement.classList.toggle("dark", initial === "dark");
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("oa-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("oa-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  // Sync dark class on mount before first paint (prevent FOUC for SSR)
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("oa-theme");
      if (!stored) {
        const next = e.matches ? "dark" : "light";
        setThemeState(next);
        document.documentElement.classList.toggle("dark", next === "dark");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  if (!mounted) {
    // Render with theme-aware shell to avoid flash — use CSS dark class already set via script
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: "dark" as Theme, toggleTheme: () => {}, setTheme: () => {} };
  }
  return ctx;
}
