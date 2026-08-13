"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "valtech-theme";

type Theme = "dark" | "light";

const listeners = new Set<(theme: Theme) => void>();

let currentTheme: Theme | null = null;

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

function applyTheme(theme: Theme) {
  currentTheme = theme;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_KEY, theme);
  }
  listeners.forEach((l) => l(theme));
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onTheme = (t: Theme) => setThemeState(t);
    listeners.add(onTheme);
    if (currentTheme) setThemeState(currentTheme);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === "dark" || e.newValue === "light")) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onTheme);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [theme, setThemeState];
}
