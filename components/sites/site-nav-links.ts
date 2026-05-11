/**
 * Definição compartilhada das rotas do site público (Phase 7 #161).
 *
 * Pure data — usável tanto pelo `SiteHeader` (Server Component) quanto
 * pelo `MobileNav` (Client Component) sem cruzar a fronteira de bundle
 * com lógica server-only.
 */

export type ActivePage =
  | "home"
  | "sobre"
  | "estoque"
  | "contato"
  | "anunciar";

export interface SiteNavLink {
  id: ActivePage;
  label: string;
  href: string;
}

export function buildSiteNavLinks(slug: string): ReadonlyArray<SiteNavLink> {
  const base = `/sites/${slug}`;
  return [
    { id: "home", label: "Home", href: base },
    { id: "estoque", label: "Estoque", href: `${base}/estoque` },
    { id: "sobre", label: "Sobre", href: `${base}/sobre` },
    { id: "contato", label: "Contato", href: `${base}/contato` },
    { id: "anunciar", label: "Anunciar", href: `${base}/anunciar` },
  ];
}
