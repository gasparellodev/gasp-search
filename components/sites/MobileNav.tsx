"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, MessageCircle, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import type { SiteNavLink, ActivePage } from "./site-nav-links";

interface MobileNavProps {
  links: ReadonlyArray<SiteNavLink>;
  activePage: ActivePage;
  primaryColor: string;
  textOnPrimary: string;
  businessName: string;
  whatsappHref: string;
}

/**
 * Sub-component client-side do `SiteHeader` que controla o menu mobile.
 * Radix Dialog entrega focus trap, ESC, outside interactions e body scroll
 * lock; a camada local adiciona back-button handling e foco de retorno.
 */
export function MobileNav({
  links,
  activePage,
  primaryColor,
  textOnPrimary,
  businessName,
  whatsappHref,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const pushedHistoryRef = useRef(false);
  const dialogId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    if (!pushedHistoryRef.current) {
      window.history.pushState({ mobileNavOpen: true }, "", window.location.href);
      pushedHistoryRef.current = true;
    }

    const onPopState = () => {
      pushedHistoryRef.current = false;
      setOpen(false);
      queueMicrotask(() => buttonRef.current?.focus());
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
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
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) closeAndRestoreFocus();
      }}
      modal
    >
      <DialogPrimitive.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={dialogId}
          aria-label="Abrir menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] text-[var(--auto-foreground,#0a0a0a)] transition-colors hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
        >
          <Menu className="size-6" aria-hidden />
        </button>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[var(--z-header,50)] bg-black/40 data-closed:animate-out data-open:animate-in data-closed:fade-out-0 data-open:fade-in-0"
        />
        <DialogPrimitive.Content
          id={dialogId}
          data-mobile-nav="content"
          aria-labelledby={titleId}
          aria-describedby={undefined}
          className="fixed inset-0 z-[calc(var(--z-header,50)+1)] flex flex-col bg-[var(--auto-background,#fafafa)] text-[var(--auto-foreground,#0a0a0a)] outline-none data-closed:animate-out data-open:animate-in data-closed:fade-out-0 data-open:fade-in-0 md:hidden"
          onClickCapture={(event) => {
            const target = event.target;
            if (
              target instanceof HTMLElement &&
              !target.closest("a,button")
            ) {
              closeAndRestoreFocus();
            }
          }}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--auto-border,#e5e5e5)] px-4">
            <DialogPrimitive.Title
              id={titleId}
              className="truncate font-[family-name:var(--auto-font-display,inherit)] text-lg font-semibold"
            >
              Menu de navegação
            </DialogPrimitive.Title>
            <span className="sr-only">{businessName}</span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--auto-radius-md,8px)] text-[var(--auto-foreground,#0a0a0a)] transition-colors hover:bg-[var(--auto-muted,#f5f5f5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
              >
                <X className="size-6" aria-hidden />
              </button>
            </DialogPrimitive.Close>
          </div>

          <nav aria-label="Menu de navegação" className="flex-1 px-4 py-8">
            <ul className="flex flex-col gap-2">
              {links.map((link) => {
                const isActive = activePage === link.id;
                return (
                  <li key={link.id}>
                    <DialogPrimitive.Close asChild>
                      <Link
                        href={link.href}
                        prefetch
                        onClick={closeAndRestoreFocus}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-[var(--auto-radius-md,8px)] px-5 py-4 text-lg font-medium transition-colors",
                          isActive
                            ? ""
                            : "text-[var(--auto-foreground,#0a0a0a)] hover:bg-[var(--auto-muted,#f5f5f5)]",
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
                    </DialogPrimitive.Close>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-[var(--auto-border,#e5e5e5)] p-4">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--auto-radius-md,8px)] bg-[var(--auto-whatsapp,#25d366)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
            >
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </a>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
