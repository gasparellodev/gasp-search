import "server-only";

/**
 * Divider decorativo do site público — faixa de rodovia tracejada (Identidade
 * Visual, Textura Ambiente).
 *
 * Server Component puro. Padrão monocromático em `--site-primary` com opacity
 * 6-8%. Aparece APENAS como divider entre seções principais — NUNCA como
 * background dentro de cards/componentes individuais.
 *
 * Implementação: repeating-linear-gradient inline pra simular as faixas
 * centrais da rodovia (12px traço + 8px gap). Largura 100%, altura
 * variável por variant:
 *  - default: 6px (entre TrustStrip e Categorias — bloco original)
 *  - thin: 2px (Wave A6 — recorrente entre todas as sections; spec D-32
 *    "identity pass: RoadDivider entre TODAS as sections").
 */
type RoadDividerVariant = "default" | "thin";

interface RoadDividerProps {
  variant?: RoadDividerVariant;
}

export function RoadDivider({ variant = "default" }: RoadDividerProps = {}) {
  const heightClass = variant === "thin" ? "h-0.5" : "h-1.5";
  const opacity = variant === "thin" ? 0.12 : 0.08;

  return (
    <div
      data-testid="road-divider"
      data-variant={variant}
      aria-hidden
      className={`mx-auto ${heightClass} w-full max-w-7xl px-4 md:px-8`}
    >
      <div
        className="h-full"
        style={{
          opacity,
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--site-primary) 0 12px, transparent 12px 20px)",
        }}
      />
    </div>
  );
}
