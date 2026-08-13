"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "../lib/use-theme";

export default function ThemeToggle({ size = 13 }: { size?: number }) {
  const [theme, setTheme] = useTheme();

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "Activar modo oscuro" : "Activar modo claro"}
      title={next === "dark" ? "Modo oscuro" : "Modo claro"}
      className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <HugeiconsIcon icon={theme === "dark" ? Sun01Icon : Moon01Icon} size={size} strokeWidth={2} />
    </button>
  );
}
