import "server-only";

import {
  getMonogramInitials,
  MONOGRAM_CENTER,
  MONOGRAM_VIEWBOX,
} from "@/lib/sites/monogram-svg";
import { cn } from "@/lib/utils";

interface HomeHeroMonogramProps {
  /** Nome do negócio — extraído iniciais via `getMonogramInitials`. */
  businessName: string;
  /**
   * Posicionamento da marca d'água:
   *  - `corner` (default): top-right offset overflow — usado mobile e
   *    como ornamento secundário desktop.
   *  - `behind`: full-bleed centrado atrás do lockup tipográfico —
   *    assina o hero em escala gigante (desktop).
   */
  variant?: "corner" | "behind";
  /** Classe extra para sobreposição (ex.: animation delay). */
  className?: string;
}

/**
 * SVG monogram watermark do hero (Hero Redesign — Phase 7).
 *
 * Server Component. Renderiza um SVG inline com as iniciais do
 * `business_name` em outline-only (stroke branco translúcido via
 * `.hero-monogram` que aplica `mix-blend-mode: screen`). Funciona com
 * qualquer `--site-primary` porque o tint vem do `mix-blend` sobre o
 * fundo cinematic dark.
 *
 * `aria-hidden` — decorativo, leitor de tela ignora.
 *
 * Performance: SVG estático server-rendered, sem fetch, sem
 * dependência externa, ~300 bytes no DOM.
 */
export function HomeHeroMonogram({
  businessName,
  variant = "corner",
  className,
}: HomeHeroMonogramProps) {
  const initials = getMonogramInitials(businessName);

  // Fix pass 1: variant "behind" agora vai pro canto inferior-direito
  // (não centro) com escala menor. Centralizado em escala gigante criava
  // colisão com o lockup quando foto era clara.
  const positionClass =
    variant === "behind"
      ? "absolute -right-8 -bottom-16 md:-right-16 md:-bottom-24"
      : "absolute -right-12 -top-16 md:-right-20 md:-top-20";

  const sizeClass =
    variant === "behind"
      ? "h-[40vh] w-[40vh] max-h-[440px] max-w-[440px] md:h-[44vh] md:w-[44vh]"
      : "h-[40vw] w-[40vw] max-h-[280px] max-w-[280px] md:h-[18rem] md:w-[18rem]";

  return (
    <div
      data-testid={`home-hero-monogram-${variant}`}
      data-variant={variant}
      aria-hidden="true"
      className={cn("hero-monogram", positionClass, className)}
    >
      <svg
        viewBox={MONOGRAM_VIEWBOX}
        className={cn(sizeClass, "block")}
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x={MONOGRAM_CENTER.x}
          y={MONOGRAM_CENTER.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--auto-font-display, serif)"
          fontSize="140"
          fontWeight="500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          letterSpacing="-4"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
}
