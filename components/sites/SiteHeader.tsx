import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { sanitizeHex } from "@/lib/sites/sanitize";
import type { SiteVariables } from "@/types/lead-site";

import { MobileNav } from "./MobileNav";
import { buildSiteNavLinks, type ActivePage } from "./site-nav-links";

type HeaderVariables = Pick<
  SiteVariables,
  "business_name" | "logo_url" | "primary_color" | "text_on_primary"
>;

interface SiteHeaderProps {
  variables: HeaderVariables;
  /** Slug do site, usado para construir as rotas (`/sites/<slug>/...`). */
  slug: string;
  /** Página corrente — recebe variant "Selected" no nav. */
  activePage: ActivePage;
}

/**
 * Header global do site público (Phase 7 — issue #161).
 *
 * Server Component. O único pedaço client é `<MobileNav>` (estado do menu
 * hambúrguer). Renderiza:
 *   - Logo (link → `/sites/<slug>`).
 *   - Nav desktop (≥768px) com 4 links + variant "Selected" no link ativo.
 *   - Hambúrguer mobile (<768px) que abre menu dropdown.
 *
 * As cores ativas vêm via CSS vars (`--site-primary` /
 * `--site-text-on-primary`) injetadas pelo wrapper `<SitePage>` (issue
 * #160). Aqui também passamos os valores sanitizados como `style` inline no
 * fallback, para garantir que o ative variant funcione mesmo se o wrapper
 * ainda não estiver presente (testes RTL renderizam o header isolado).
 */
export function SiteHeader({ variables, slug, activePage }: SiteHeaderProps) {
  const links = buildSiteNavLinks(slug);
  const homeHref = `/sites/${slug}`;

  const primaryColor = sanitizeHex(variables.primary_color);
  const textOnPrimary = sanitizeHex(variables.text_on_primary);

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-30 border-b border-foreground/10 bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href={homeHref}
          aria-current={activePage === "home" ? "page" : undefined}
          aria-label={variables.business_name}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-md"
        >
          <Image
            src={variables.logo_url}
            alt={variables.business_name}
            width={140}
            height={40}
            className="h-10 w-auto object-contain"
            priority
            unoptimized
          />
        </Link>

        {/* Nav desktop */}
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-2 md:flex"
        >
          <ul className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = activePage === link.id;
              return (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    data-active={isActive ? "true" : "false"}
                    className={cn(
                      "inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition",
                      isActive
                        ? "shadow-sm"
                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
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

        {/* Hambúrguer mobile */}
        <div className="md:hidden">
          <MobileNav
            links={links}
            activePage={activePage}
            primaryColor={primaryColor}
            textOnPrimary={textOnPrimary}
          />
        </div>
      </div>
    </header>
  );
}
