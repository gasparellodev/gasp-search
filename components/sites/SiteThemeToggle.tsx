"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Toggle de dark/light theme do site público (Phase 7).
 *
 * Client Component standalone — não usa Button do shadcn (que pertence ao
 * shell autenticado). Estilo: ghost button compacto, alinha com o nav do
 * SiteHeader. SSR-safe via `useSyncExternalStore` (sem setState-in-effect).
 *
 * Persistência: `next-themes` cuida via localStorage `theme` key. Default
 * herdado do `ThemeProvider` em `app/layout.tsx` (light).
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function SiteThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      data-testid="site-theme-toggle"
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      onClick={toggle}
      disabled={!mounted}
      className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isDark ? (
        <Sun aria-hidden className="size-4" />
      ) : (
        <Moon aria-hidden className="size-4" />
      )}
    </button>
  );
}
