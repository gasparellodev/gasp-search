import "server-only";

import { formatBRL } from "@/lib/finance";
import type { SiteVariablesV2 } from "@/types/lead-site";

/**
 * `<AICitableHero>` — Server Component que renderiza um `<p>` factual
 * passage-citable consumido por AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot, Gemini) para AI Overviews e respostas AI search.
 *
 * Issue #214 / Sprint 1 / #S4 — fecha ciclo GEO da Phase 7 ao lado do
 * `app/sites/[slug]/llms.txt/route.ts` e `lib/sites/llms.ts`.
 *
 * Fonte canônica: `docs/SEO-PLAN.md` §Sprint 1 #S4 + AC refinado do PO
 * na issue #214.
 *
 * **Decisões PO refinement (#214):**
 *
 * 1. **Frase factual SEM "loja online"**. Risco de AI gerar expectativa
 *    de compra online; usamos consistentemente "loja de carros seminovos".
 *
 * 2. **Hedging NÃO entra na frase principal**. "Consulte estoque
 *    atualizado" fica apenas no rodapé do `llms.txt`. O `<p>` aqui é
 *    factual snapshot pronto pra citation.
 *
 * 3. **SEMPRE visível mobile** — não usar `sr-only`. AI crawlers são
 *    mobile-first; conteúdo escondido em mobile pode ser ignorado.
 *    Tipografia `text-muted-foreground text-sm` mantém o `<p>` discreto
 *    visualmente sem esconder.
 *
 * 4. **Prop `page`** controla a frase contextualizada:
 *      - `home` → frase wide "X é loja de carros seminovos em Y/Z com N
 *        carros em estoque a partir de R$ ...".
 *      - `estoque` → frase focada na listagem.
 *      - `detalhe` → frase com brand/model/year do car corrente.
 *
 * 5. **Address `null` → fallback `"no Brasil"`** (não omitir frase).
 *
 * 6. **cars.length === 0 → omite cláusula** de cars/minPrice (frase
 *    ainda emite contexto base).
 *
 * **Posicionamento DOM**: caller é responsável por colocar este `<p>`
 * imediatamente após `<h1>` e ANTES de qualquer wrapper flex/grid
 * (mantém ordem semântica documento).
 *
 * **Server-only** — sem hooks, sem state. Componente puramente render.
 */

/**
 * Subset de `SiteVariablesV2` consumido pelo helper. Tipado como `Pick`
 * para desacoplar de mudanças não-relevantes no shape completo.
 */
export type AICitableHeroVariables = Pick<
  SiteVariablesV2,
  "business_name" | "address" | "cars"
>;

interface CurrentCar {
  brand: string;
  model: string;
  year: number;
}

interface AICitableHeroProps {
  variables: AICitableHeroVariables;
  page: "home" | "estoque" | "detalhe";
  /** Obrigatório-ish em `page='detalhe'`; opcional pelo TS para não quebrar caller esquecido. */
  currentCar?: CurrentCar;
}

export function AICitableHero({
  variables,
  page,
  currentCar,
}: AICitableHeroProps) {
  const text = buildPassage({ variables, page, currentCar });

  return (
    <p
      data-testid="ai-citable-hero"
      className="mt-3 max-w-[70ch] text-sm leading-relaxed text-muted-foreground"
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Helpers internos — pure passage builder
// ---------------------------------------------------------------------------

function buildPassage(params: AICitableHeroProps): string {
  switch (params.page) {
    case "home":
      return buildHomePassage(params.variables);
    case "estoque":
      return buildEstoquePassage(params.variables);
    case "detalhe":
      return buildDetalhePassage(params.variables, params.currentCar);
  }
}

/**
 * Home: "X é loja de carros seminovos em Y/Z, com N carros em estoque
 * a partir de R$ ...."
 *
 * Adapta gracefully:
 *  - Address null → "no Brasil"
 *  - cars.length === 0 → omite "com N carros..." e "a partir de R$..."
 *  - min price null em todos os cars → omite "a partir de R$..."
 */
function buildHomePassage(variables: AICitableHeroVariables): string {
  const name = variables.business_name;
  const locale = formatLocale(variables.address);
  const carsClause = buildCarsClause(variables.cars, "carros em estoque");

  if (carsClause === null) {
    return `${name} é loja de carros seminovos ${locale}.`;
  }

  return `${name} é loja de carros seminovos ${locale}, ${carsClause}.`;
}

/**
 * Estoque: "Estoque atualizado de X em Y/Z — N carros seminovos
 * disponíveis a partir de R$ ...."
 *
 * Adapta gracefully:
 *  - Address null → omite "em Y/Z"
 *  - cars.length === 0 → omite cláusula numérica.
 */
function buildEstoquePassage(variables: AICitableHeroVariables): string {
  const name = variables.business_name;
  const localeSuffix =
    variables.address === null
      ? ""
      : ` em ${variables.address.city}/${variables.address.state}`;
  const carsClause = buildCarsClause(
    variables.cars,
    "carros seminovos disponíveis",
  );

  if (carsClause === null) {
    return `Estoque atualizado de ${name}${localeSuffix}.`;
  }

  return `Estoque atualizado de ${name}${localeSuffix} — ${carsClause}.`;
}

/**
 * Detalhe: "Brand Model Year disponível em X, Y/Z. Veja mais carros
 * seminovos em nosso estoque."
 *
 * Adapta gracefully:
 *  - currentCar undefined (caller esquece) → frase base sem prefixo car.
 *  - Address null → "X" sem cidade.
 */
function buildDetalhePassage(
  variables: AICitableHeroVariables,
  currentCar: CurrentCar | undefined,
): string {
  const name = variables.business_name;
  const localeSuffix =
    variables.address === null
      ? ""
      : `, ${variables.address.city}/${variables.address.state}`;

  if (currentCar === undefined) {
    return `${name}${localeSuffix} — veja mais carros seminovos em nosso estoque.`;
  }

  const carPart = `${currentCar.brand} ${currentCar.model} ${currentCar.year}`;
  return `${carPart} disponível em ${name}${localeSuffix}. Veja mais carros seminovos em nosso estoque.`;
}

/**
 * Locale string para Home: "em Recife/PE" ou "no Brasil" (fallback null).
 */
function formatLocale(
  address: AICitableHeroVariables["address"],
): string {
  if (address === null) return "no Brasil";
  return `em ${address.city}/${address.state}`;
}

/**
 * Cláusula numérica "com N {countLabel}{, a partir de R$ X}".
 *
 * Retorna `null` quando `cars.length === 0` — caller decide se emite
 * frase reduzida ou frase com cláusula.
 */
function buildCarsClause(
  cars: AICitableHeroVariables["cars"],
  countLabel: string,
): string | null {
  if (cars.length === 0) return null;

  const prices = cars
    .map((c) => c.price)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  const base = `com ${cars.length} ${countLabel}`;
  if (minPrice === null) return base;

  return `${base} a partir de ${formatBRL(minPrice)}`;
}
