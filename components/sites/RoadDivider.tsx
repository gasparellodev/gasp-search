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
 * centrais da rodovia (12px traço + 8px gap). Largura 100%, altura 6px.
 */
export function RoadDivider() {
  return (
    <div
      data-testid="road-divider"
      aria-hidden
      className="mx-auto h-1.5 w-full max-w-7xl px-4 md:px-8"
    >
      <div
        className="h-full opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, var(--site-primary) 0 12px, transparent 12px 20px)",
        }}
      />
    </div>
  );
}
