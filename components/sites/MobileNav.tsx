"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SiteNavLink, ActivePage } from "./site-nav-links";

interface MobileNavProps {
  links: ReadonlyArray<SiteNavLink>;
  activePage: ActivePage;
  primaryColor: string;
  textOnPrimary: string;
}

/**
 * Sub-component client-side do `SiteHeader` que controla o menu mobile
 * (hambúrguer). Estado local `open`; foco volta ao botão hambúrguer ao
 * fechar para acessibilidade.
 *
 * O componente principal `SiteHeader` é Server — só esse pedaço cruza
 * a fronteira pro client.
 */
export function MobileNav({
  links,
  activePage,
  primaryColor,
  textOnPrimary,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();

  // Fecha menu ao apertar ESC e devolve foco ao botão.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    // Microtask para garantir que o React já tenha feito o re-render antes do focus.
    queueMicrotask(() => {
      buttonRef.current?.focus();
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>

      <div
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        aria-hidden={!open}
        className={cn(
          "fixed inset-x-0 top-[64px] z-40 border-t border-foreground/10 bg-background shadow-lg transition-all md:hidden",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <ul className="flex flex-col gap-1 p-4">
          {links.map((link) => {
            const isActive = activePage === link.id;
            return (
              <li key={link.id}>
                <Link
                  href={link.href}
                  onClick={closeAndRestoreFocus}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block rounded-full px-5 py-3 text-base font-medium transition",
                    isActive
                      ? "bg-[var(--site-primary,#0C0C0C)] text-[var(--site-text-on-primary,#FFFFFF)]"
                      : "text-foreground hover:bg-foreground/5",
                  )}
                  style={
                    isActive
                      ? {
                          backgroundColor: primaryColor,
                          color: textOnPrimary,
                        }
                      : undefined
                  }
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
