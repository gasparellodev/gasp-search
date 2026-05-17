"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { sanitizeHex } from "@/lib/sites/sanitize";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { SiteVariablesV2 } from "@/types/lead-site";

import { MobileNav } from "./MobileNav";
import { buildSiteNavLinks, type ActivePage } from "./site-nav-links";

type HeaderVariables = Pick<
  SiteVariablesV2,
  "business_name" | "brand_assets" | "whatsapp" | "cars"
>;

interface SiteHeaderProps {
  variables: HeaderVariables;
  /** Slug do site, usado para construir as rotas (`/sites/<slug>/...`). */
  slug: string;
  /** Página corrente — recebe variant "Selected" no nav. */
  activePage: ActivePage;
}

function activePageFromPathname(
  pathname: string | null,
  slug: string,
): ActivePage | null {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/$/, "");
  const base = `/sites/${slug}`;
  if (normalized === base) return "home";
  if (normalized.startsWith(`${base}/estoque`)) return "estoque";
  if (normalized === `${base}/sobre`) return "sobre";
  if (normalized === `${base}/contato`) return "contato";
  if (normalized === `${base}/anunciar`) return "anunciar";
  return null;
}

function useHeaderScrolled() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const sentinel = document.querySelector("[data-site-header-sentinel]");
    let frame = 0;

    const updateFromScroll = () => {
      frame = 0;
      setIsScrolled(window.scrollY > 8);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(updateFromScroll);
    };

    if ("IntersectionObserver" in window && sentinel) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          setIsScrolled(!entry.isIntersecting);
        },
        { root: null, threshold: 0 },
      );
      observer.observe(sentinel);
      updateFromScroll();
      return () => {
        if (frame !== 0) window.cancelAnimationFrame(frame);
        observer.disconnect();
      };
    }

    updateFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return isScrolled;
}

/**
 * Header global glass-sticky do site público (Phase 7 Sprint 3 — #218).
 *
 * Client Component porque o estado visual depende de `IntersectionObserver`,
 * `usePathname()` e fallback de erro do logo. `SitePage` segue server-only e
 * passa apenas dados já validados do site.
 */
export function SiteHeader({ variables, slug, activePage }: SiteHeaderProps) {
  const hasStock = (variables.cars?.length ?? 0) > 0;
  const links = buildSiteNavLinks(slug, { hasStock });
  const homeHref = `/sites/${slug}`;
  const pathname = usePathname();
  const currentPage = activePageFromPathname(pathname, slug) ?? activePage;
  const isScrolled = useHeaderScrolled();

  const { brand_assets } = variables;
  const primaryColor = sanitizeHex(brand_assets.primary_color);
  const textOnPrimary = sanitizeHex(brand_assets.text_on_primary);
  const logoUrl = brand_assets.logo_url;
  const [logoFailed, setLogoFailed] = useState(false);

  const whatsappHref = useMemo(
    () =>
      buildWhatsAppLink({
        phone: variables.whatsapp,
        businessName: variables.business_name,
        siteSlug: slug,
        template: "general",
        component: "header",
      }),
    [slug, variables.business_name, variables.whatsapp],
  );
  const showLogoImage = Boolean(logoUrl) && !logoFailed;

  return (
    <header
      data-testid="site-header"
      data-scrolled={isScrolled ? "true" : "false"}
      className={cn(
        "site-header-glass group/site-header sticky top-0 z-[var(--z-header,50)] transform-gpu transition-[background-color,border-color,backdrop-filter] duration-[var(--auto-duration-base,250ms)] ease-[var(--auto-ease-out,cubic-bezier(0.16,1,0.3,1))]",
        isScrolled
          ? "border-b border-[var(--auto-border,#e5e5e5)] bg-[rgb(250_250_250_/_0.84)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
        // Wave B10 (D-27): mini scrim no estado não-scrolled garante
        // contraste do texto branco do header sobre hero images claros
        // (céu, fundo branco de showroom). Aplicado via ::before só
        // quando !isScrolled.
        !isScrolled &&
          "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-b before:from-black/30 before:to-transparent",
      )}
      style={{ transform: "translateZ(0)", willChange: "backdrop-filter" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
        <Link
          href={homeHref}
          prefetch
          aria-current={currentPage === "home" ? "page" : undefined}
          aria-label={variables.business_name}
          className="flex min-w-0 items-center gap-2 rounded-[var(--auto-radius-md,8px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-focus-ring,#0a0a0a)]"
        >
          {showLogoImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- #218 requires plain <img>; logos are small pre-sanitized public assets.
            <img
              src={logoUrl}
              alt={variables.business_name}
              width={200}
              height={56}
              onError={() => setLogoFailed(true)}
              className="block max-h-10 w-auto max-w-[12rem] object-contain md:max-h-11 md:max-w-[14rem]"
            />
          ) : (
            <span
              data-testid="site-header-logo-text"
              className="truncate font-[family-name:var(--auto-font-display,inherit)] text-xl font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] group-data-[scrolled=true]/site-header:text-[var(--auto-foreground,#0a0a0a)] group-data-[scrolled=true]/site-header:[text-shadow:none] md:text-2xl"
            >
              {variables.business_name}
            </span>
          )}
        </Link>

        {/* Nav desktop */}
        <div className="hidden items-center gap-2 md:flex">
          <nav aria-label="Navegação principal">
            <ul className="flex items-center gap-1">
              {links.map((link) => {
                const isActive = currentPage === link.id;
                return (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      prefetch
                      aria-current={isActive ? "page" : undefined}
                      data-active={isActive ? "true" : "false"}
                      className={cn(
                        "inline-flex items-center rounded-[var(--auto-radius-full,9999px)] px-4 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? ""
                          : "text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] hover:bg-white/10 group-data-[scrolled=true]/site-header:text-[var(--auto-foreground,#0a0a0a)]/75 group-data-[scrolled=true]/site-header:[text-shadow:none] group-data-[scrolled=true]/site-header:hover:bg-[var(--auto-muted,#f5f5f5)] group-data-[scrolled=true]/site-header:hover:text-[var(--auto-foreground,#0a0a0a)]",
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
          </nav>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-2 rounded-[var(--auto-radius-full,9999px)] border border-[var(--auto-whatsapp,#25d366)] px-4 py-2 text-sm font-semibold text-[var(--auto-whatsapp,#25d366)] transition-colors hover:text-[var(--auto-whatsapp-hover,#1fb855)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auto-whatsapp,#25d366)]"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
        </div>

        {/* Hambúrguer mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <MobileNav
            links={links}
            activePage={currentPage}
            primaryColor={primaryColor}
            textOnPrimary={textOnPrimary}
            businessName={variables.business_name}
            whatsappHref={whatsappHref}
          />
        </div>
      </div>
    </header>
  );
}
