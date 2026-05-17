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
  | "anunciar"
  | "lgpd";

export interface SiteNavLink {
  id: ActivePage;
  label: string;
  href: string;
}

export interface BuildSiteNavLinksOptions {
  /**
   * Wave A3 (D-13): quando o lead não tem carros no estoque
   * (`cars.length === 0`), o link "Estoque" some da nav — evita levar
   * visitante a `/estoque` que só renderiza empty state e quebra o funil.
   * Default `true` para retrocompat.
   */
  hasStock?: boolean;
}

export function buildSiteNavLinks(
  slug: string,
  options: BuildSiteNavLinksOptions = {},
): ReadonlyArray<SiteNavLink> {
  const base = `/sites/${slug}`;
  const { hasStock = true } = options;
  const links: SiteNavLink[] = [
    { id: "home", label: "Home", href: base },
  ];
  if (hasStock) {
    links.push({ id: "estoque", label: "Estoque", href: `${base}/estoque` });
  }
  links.push(
    { id: "sobre", label: "Sobre", href: `${base}/sobre` },
    { id: "contato", label: "Contato", href: `${base}/contato` },
    { id: "anunciar", label: "Anunciar", href: `${base}/anunciar` },
  );
  return links;
}
