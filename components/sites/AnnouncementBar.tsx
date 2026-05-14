import "server-only";

import { sanitizeAnnouncementText } from "@/lib/sites/sanitize";

import { AnnouncementBarMarquee } from "./AnnouncementBarMarquee";

interface AnnouncementBarProps {
  /**
   * Texto bruto vindo de `visual_identity.announcement_text`. Caller
   * (`SitePage`) passa o campo direto do manifest; este componente
   * faz a sanitização final (strip HTML, trim, clamp 140) e decide
   * se renderiza.
   */
  text: string | null | undefined;
}

/**
 * Bar de avisos rolando acima do `<SiteHeader>` (Phase 7 / WP2 — issue #291).
 *
 * Server Component. Sanitiza o texto e delega o marquee animado para o
 * `<AnnouncementBarMarquee>` (Client) — necessário porque o loop infinito
 * via anime.js + respeito a `prefers-reduced-motion` precisa rodar no
 * browser.
 *
 * **Decisão**: bar **não renderiza** (retorna `null`) quando o texto
 * sanitizado é vazio. Container `h-9` evita CLS quando o bar está
 * presente — mas a ausência total é preferível ao container vazio em
 * sites sem aviso configurado.
 */
export function AnnouncementBar({ text }: AnnouncementBarProps) {
  const sanitized = sanitizeAnnouncementText(text);
  if (sanitized === null) return null;

  return (
    <aside
      role="complementary"
      aria-label="Avisos da loja"
      data-testid="announcement-bar"
      className="flex h-9 w-full items-center overflow-hidden"
      style={{
        backgroundColor: "var(--auto-primary, var(--site-primary, #0c0c0c))",
        color:
          "var(--auto-text-on-primary, var(--site-text-on-primary, #ffffff))",
      }}
    >
      <AnnouncementBarMarquee text={sanitized} />
    </aside>
  );
}
