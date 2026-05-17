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

  const positionClass =
    variant === "behind"
      ? "absolute inset-0 flex items-center justify-center"
      : "absolute -right-12 -top-16 md:-right-24 md:-top-24";

  const sizeClass =
    variant === "behind"
      ? "h-[80vh] w-[80vh] max-h-[900px] max-w-[900px]"
      : "h-[60vw] w-[60vw] max-h-[420px] max-w-[420px] md:h-[24rem] md:w-[24rem]";

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
          fontSize="180"
          fontWeight="600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          letterSpacing="-8"
        >
          {initials}
        </text>
      </svg>
    </div>
  );
}
