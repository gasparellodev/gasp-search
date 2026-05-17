/**
 * Schema.org JSON-LD builders — Phase 7 Sprint 1 / #S1 (issue #211).
 *
 * Fonte canônica: `docs/SEO-PLAN.md` §"AI-first SEO foundation" + spec §13
 * (`docs/superpowers/specs/2026-05-08-gerador-sites-concessionarias-design.md`).
 *
 * **Moat técnico Phase 7:** 0/28 concorrentes BR de mini-sites de
 * concessionária têm `AutoDealer` + `Vehicle` JSON-LD. Esta camada
 * habilita citação por AI Overviews / Perplexity / ChatGPT search e
 * eligibilidade para Rich Results (vehicle listings) no Google.
 *
 * **Builders puros, sem I/O.** Cada função recebe `SiteVariablesV2`
 * (subset) e retorna um node JSON-LD pronto pra serialização. Lê apenas
 * `env.NEXT_PUBLIC_APP_URL` pra montar `@id` absolutos.
 *
 * **Decisões PO refinement (issue #211):**
 *
 * 1. **`@graph` single-script no layout.** `buildSitewideGraph` retorna
 *    `{@context, @graph: [AutoDealer, WebSite, Organization, LocalBusiness]}`
 *    — 1 script-tag única vs 4. Linking via `@id` cross-references valida
 *    melhor no Rich Results Test e reduz parsing overhead. WebSite
 *    adicionado em #213 (Sprint 1 / #S3) com `publisher` linkando ao
 *    Organization existente.
 *
 * 2. **`address === null` → key omitida.** Não emite `PostalAddress`
 *    vazio com só `addressCountry: 'BR'` (spam sinal). Schema.org permite
 *    `AutoDealer`/`LocalBusiness` sem `address`.
 *
 * 3. **`Vehicle.itemCondition: UsedCondition`** fixed (todos seminovos
 *    no produto V1). URL completa `https://schema.org/UsedCondition`.
 *
 * 4. **`Vehicle.priceCurrency: 'BRL'`** fixed. `price` serializado como
 *    string per spec (Google Rich Results aceita).
 *
 * 5. **`Vehicle.image: photos[]`** array completo quando `photos.length > 0`.
 *    Fallback `thumbnail_url` (string) quando `photos` undefined (v1
 *    legado) ou `photos.length === 0`.
 *
 * 6. **`Organization.sameAs` omitido quando todas social URLs null.**
 *    Não emite array vazio (Schema.org valida `sameAs` como array
 *    não-vazio quando presente).
 *
 * 7. **`AutoDealer.priceRange` omitido quando `cars.length === 0`.**
 *    Não calcula min/max sobre array vazio.
 *
 * **Server-only.** Usado apenas em Server Components/layouts. Lê `env`
 * que requer `import 'server-only'` upstream.
 */
import "server-only";

// NOTE: `schema-dts` é instalado como devDep e usado conceitualmente como
// referência ao vocabulário Schema.org (auto-complete em IDE, tipos
// disponíveis quando alguém precisar de WithContext<Vehicle> em outro
// caller). No runtime dos builders, retornamos `JsonLdNode` (alias
// `Record<string, unknown>`) — schema-dts gera unions tão exaustivos que
// inviabilizam asserts em test/caller (`schema['@type']` vira `never`).
// O ganho de tipos opacos não justifica o custo de DX.

import { env } from "@/lib/env";
import type { Address, SiteCar, SiteVariablesV2 } from "@/types/lead-site";

/**
 * Node JSON-LD genérico — shape Schema.org. Usamos `Record<string, unknown>`
 * em vez dos types narrow do `schema-dts` por DX (asserts/access em
 * callers). Validação real fica no Rich Results Test (manual) + tests
 * runtime.
 */
export type JsonLdNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Subset de SiteVariablesV2 consumido pelos builders
// ---------------------------------------------------------------------------

/**
 * Subset de `SiteVariablesV2` necessário pros builders. Tipado como `Pick`
 * pra desacoplar do shape completo em testes — mas runtime aceita o
 * objeto inteiro (Zod-parseable).
 */
export type SchemaInput = Pick<
  SiteVariablesV2,
  | "business_name"
  | "business_slug"
  | "slogan"
  | "address"
  | "phone_display"
  | "whatsapp"
  | "email"
  | "hours"
  | "instagram_url"
  | "facebook_url"
  | "youtube_url"
  | "brand_assets"
  | "cars"
>;

// ---------------------------------------------------------------------------
// escapeJsonLd — XSS defense for <script type="application/ld+json">
// ---------------------------------------------------------------------------

/**
 * Serializes `value` to JSON and escapes characters that could break out
 * of a `<script>` tag in HTML (XSS defense for JSON-LD injection).
 *
 * Uses Unicode escapes — always valid JSON per RFC 8259 §7, and
 * `JSON.parse(escapeJsonLd(v))` round-trips cleanly:
 *  - `<`  → `<`  (prevents `</script>` and `<!--`)
 *  - `>`  → `>`  (prevents `-->`)
 *  - `&`  → `&`  (prevents `&`-based injection)
 *
 * Note: previous versions used `<\/`, `--\>`, `<\!--` which are NOT valid
 * JSON escape sequences (JSON.parse throws SyntaxError on them).
 */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// ---------------------------------------------------------------------------
// safeAbsoluteUrl — ensures URLs in schema are always absolute
// ---------------------------------------------------------------------------

/**
 * Returns an absolute URL string, or `null` when the input is invalid/empty.
 *
 * - If `input` already starts with `http://` or `https://`, validates and
 *   returns it as-is (via `new URL()` to normalize trailing slashes etc.).
 * - If `input` is relative (e.g. `/foo`), prepends `env.NEXT_PUBLIC_APP_URL`.
 * - Returns `null` for empty strings, non-strings, or unparseable URLs.
 *
 * Google Rich Results requires all URL fields in structured data to be
 * absolute. This helper is the single enforcer across all schema builders.
 */
export function safeAbsoluteUrl(
  input: string | null | undefined,
): string | null {
  if (!input || typeof input !== "string") return null;
  try {
    // Read directly from process.env so tests can override without
    // re-importing the Zod-validated singleton (which is frozen at
    // module-load time). In production, this value equals env.NEXT_PUBLIC_APP_URL.
    const base = process.env.NEXT_PUBLIC_APP_URL;
    const url =
      input.startsWith("http://") || input.startsWith("https://")
        ? new URL(input)
        : base
          ? new URL(input, base)
          : null;
    if (!url) return null;
    // Whitelist http/https — mirrors lib/sites/sanitize.ts::safeUrl pattern.
    // Blocks javascript:, data:, file:, vbscript:, etc.
    // Note: new URL("javascript:alert(1)", base) returns the javascript: URL
    // as-is (URL constructor doesn't apply base to absolute URIs), so we must
    // check the resolved protocol, not just the input string prefix.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers internos — URLs, fragmentos, formatação
// ---------------------------------------------------------------------------

/**
 * Base URL absoluta pro site (sem trailing slash). Lê `env.NEXT_PUBLIC_APP_URL`
 * validado em `lib/env.ts`.
 */
function baseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/**
 * URL canônica raiz do site (`<base>/sites/<slug>`).
 */
function siteUrl(slug: string): string {
  return `${baseUrl()}/sites/${slug}`;
}

/**
 * `@id` absoluto com fragment. Usado pra cross-reference entre nodes do
 * `@graph` (AutoDealer.parentOrganization → Organization, Vehicle.seller
 * → AutoDealer, etc).
 */
function siteId(slug: string, fragment: string): string {
  return `${siteUrl(slug)}#${fragment}`;
}

/**
 * Formata preço BRL sem decimais pro display em `priceRange`.
 * Ex: `269900` → `"R$ 269.900"`.
 */
function formatPriceRange(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

/**
 * Converte `whatsapp` (`5511987654321`) em E.164 (`+5511987654321`).
 * Schema.org `telephone` aceita E.164 e formatos locais — preferimos
 * E.164 pra compatibilidade internacional (AI crawlers).
 */
function toE164(whatsapp: string): string {
  return whatsapp.startsWith("+") ? whatsapp : `+${whatsapp}`;
}

/**
 * Mapeia `SiteCar.fuel` (PT-BR) → vocabulário Schema.org (`vehicleFuelType`).
 * Default `Gasoline` quando enum inesperado (defensivo — Zod já valida).
 */
function mapFuelType(fuel: SiteCar["fuel"]): string {
  switch (fuel) {
    case "Gasolina":
      return "Gasoline";
    case "Etanol":
      return "Ethanol";
    case "Flex":
      return "Flex";
    case "Diesel":
      return "Diesel";
    case "Híbrido":
      return "Hybrid";
    case "Elétrico":
      return "Electric";
    default:
      return "Gasoline";
  }
}

/**
 * Mapeia `SiteCar.transmission` (PT-BR) → vocabulário Schema.org.
 */
function mapTransmission(transmission: SiteCar["transmission"]): string {
  switch (transmission) {
    case "Automático":
      return "Automatic";
    case "Manual":
      return "Manual";
    case "CVT":
      return "CVT";
    default:
      return "Other";
  }
}

/**
 * Constrói `PostalAddress` Schema.org a partir de `Address` v2.
 * `streetAddress` concatena `<street>, <number>` (compatível com Google
 * Business Profile addresses).
 */
function buildPostalAddress(address: Address): {
  "@type": "PostalAddress";
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
} {
  return {
    "@type": "PostalAddress",
    streetAddress: `${address.street}, ${address.number}`,
    addressLocality: address.city,
    addressRegion: address.state,
    postalCode: address.zip,
    addressCountry: address.country,
  };
}

/**
 * Coleta `sameAs[]` apenas com URLs não-null. Retorna `undefined` quando
 * todas são null — caller decide se omite key inteira.
 */
function collectSameAs(
  variables: Pick<SchemaInput, "instagram_url" | "facebook_url" | "youtube_url">,
): string[] | undefined {
  const urls = [
    variables.instagram_url,
    variables.facebook_url,
    variables.youtube_url,
  ].filter((u): u is string => u !== null);
  return urls.length > 0 ? urls : undefined;
}

// ---------------------------------------------------------------------------
// buildAutoDealerSchema — node principal do AutoDealer
// ---------------------------------------------------------------------------

/**
 * `AutoDealer` (Schema.org) — entidade principal do site da concessionária.
 *
 * Inclui:
 *  - `@id` `#dealer` para cross-reference de `Vehicle.seller`.
 *  - `parentOrganization` linkando o `Organization` `#org`.
 *  - `priceRange` (min/max preços de cars) — omitido se `cars.length === 0`.
 *  - `address` PostalAddress — omitido se `address === null`.
 *  - `image` = `brand_assets.logo_url`.
 */
export function buildAutoDealerSchema(
  variables: SchemaInput,
): JsonLdNode {
  const slug = variables.business_slug;
  const url = siteUrl(slug);

  // Definimos shape progressivamente pra poder omitir keys condicionais
  // (`address` quando null, `priceRange` quando cars vazio, etc).
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": siteId(slug, "dealer"),
    name: variables.business_name,
    url,
    image: variables.brand_assets.logo_url,
    telephone: toE164(variables.whatsapp),
    parentOrganization: {
      "@id": siteId(slug, "org"),
    },
  };

  if (variables.email !== null) {
    schema.email = variables.email;
  }

  if (variables.address !== null) {
    schema.address = buildPostalAddress(variables.address);
  }

  if (variables.cars.length > 0) {
    const prices = variables.cars
      .map((c) => c.price)
      .filter((p): p is number => typeof p === "number" && p > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      schema.priceRange = `${formatPriceRange(min)} - ${formatPriceRange(max)}`;
    }
  }

  return schema;
}

// ---------------------------------------------------------------------------
// buildOrganizationSchema — Organization linkada ao AutoDealer
// ---------------------------------------------------------------------------

/**
 * `Organization` — entidade legal por trás do AutoDealer. Útil para
 * AI Overviews que distinguem `Organization` (brand) de `LocalBusiness`
 * (loja física).
 *
 * `sameAs` derivado de `instagram_url`/`facebook_url`/`youtube_url` não-null.
 * Omitido quando todas as 3 são null.
 */
export function buildOrganizationSchema(
  variables: SchemaInput,
): JsonLdNode {
  const slug = variables.business_slug;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": siteId(slug, "org"),
    name: variables.business_name,
    url: siteUrl(slug),
    logo: variables.brand_assets.logo_url,
  };

  const sameAs = collectSameAs(variables);
  if (sameAs !== undefined) {
    schema.sameAs = sameAs;
  }

  return schema;
}

// ---------------------------------------------------------------------------
// buildLocalBusinessSchema — LocalBusiness pra map pack / GBP citation
// ---------------------------------------------------------------------------

/**
 * `LocalBusiness` — necessário pra eligibilidade de map pack e citação
 * por AI Overviews que cobrem buscas locais ("seminovos perto de mim").
 *
 * Includes `openingHours` (string format livre — Google parseia heurística),
 * `telephone`, `address` (omitido se null), `image` (logo).
 *
 * TODO V2: `geo` (latitude/longitude) quando `lead.raw.location.{lat,lng}`
 * estiver disponível. Hoje `getLeadRaw` é fora de escopo (#211 cobre só
 * builders + injection — extração geo é Sprint 2).
 */
export function buildLocalBusinessSchema(
  variables: SchemaInput,
): JsonLdNode {
  const slug = variables.business_slug;
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": siteId(slug, "localbusiness"),
    name: variables.business_name,
    url: siteUrl(slug),
    image: variables.brand_assets.logo_url,
    telephone: toE164(variables.whatsapp),
  };

  if (variables.email !== null) {
    schema.email = variables.email;
  }

  if (variables.address !== null) {
    schema.address = buildPostalAddress(variables.address);
  }

  if (variables.hours !== null) {
    schema.openingHours = variables.hours;
  }

  return schema;
}

// ---------------------------------------------------------------------------
// buildWebSiteSchema — WebSite (root entity, publisher → Organization)
// ---------------------------------------------------------------------------

/**
 * `WebSite` Schema.org — entidade raiz do site público da concessionária.
 *
 * **Por que esta entidade?** Em conjunto com `Organization` e `AutoDealer`,
 * fecha a hierarquia de entidades canônicas Schema.org para sites
 * publishers (Google + AI crawlers parseiam `WebSite` para identificar
 * navegação raiz e canonical URL do domínio).
 *
 * `publisher` cross-referencia o `Organization` via `@id` (`#org`) — não
 * duplica dados. `inLanguage` fixed `pt-BR` enquanto V1 é monolíngue.
 *
 * **V1 NÃO emite `potentialAction.SearchAction`.** O site não tem busca
 * interna no MVP. Quando #estoque ganhar query string filterable (V2),
 * adicionar `SearchAction` aqui com `urlTemplate` apontando pra
 * `/estoque?q={search_term_string}`.
 */
export function buildWebSiteSchema(variables: SchemaInput): JsonLdNode {
  const slug = variables.business_slug;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteId(slug, "website"),
    name: variables.business_name,
    url: siteUrl(slug),
    inLanguage: "pt-BR",
    publisher: { "@id": siteId(slug, "org") },
  };
}

// ---------------------------------------------------------------------------
// buildVehicleSchema — Vehicle individual (rota detail)
// ---------------------------------------------------------------------------

/**
 * `Vehicle` Schema.org — emitido na página de detalhe `/estoque/<carSlug>`.
 *
 * Crítico para Rich Results de vehicle listings + citação por AI search.
 *
 * Decisões:
 *  - `itemCondition: 'https://schema.org/UsedCondition'` — fixed (produto
 *    é seminovos por design).
 *  - `priceCurrency: 'BRL'` fixed.
 *  - `image`: `car.photos[]` quando `length > 0`, senão `thumbnail_url`.
 *  - `offers.seller` → `@id` do `AutoDealer` (cross-reference via @graph).
 *  - `offers` omitido inteiro quando `car.price === null` (sem preço
 *    público — não emite Offer com price vazio).
 */
export function buildVehicleSchema(
  car: SiteCar,
  variables: SchemaInput,
): JsonLdNode {
  const slug = variables.business_slug;
  const url = `${siteUrl(slug)}/estoque/${car.slug}`;

  // `image`: array quando photos válido, single string fallback. Schema.org
  // aceita ambos (`ImageObject | URL | URL[]`).
  const hasPhotos = Array.isArray(car.photos) && car.photos.length > 0;
  const image = hasPhotos ? car.photos! : car.thumbnail_url;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "@id": `${url}#vehicle`,
    name: `${car.brand} ${car.model} ${car.year}`,
    url,
    description: car.description,
    image,
    brand: { "@type": "Brand", name: car.brand },
    model: car.model,
    vehicleModelDate: String(car.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: car.km,
      unitCode: "KMT",
    },
    itemCondition: "https://schema.org/UsedCondition",
    fuelType: mapFuelType(car.fuel),
    vehicleTransmission: mapTransmission(car.transmission),
    color: car.color,
  };

  if (typeof car.doors === "number") {
    schema.numberOfDoors = car.doors;
  }

  if (typeof car.price === "number" && car.price > 0) {
    schema.offers = {
      "@type": "Offer",
      price: String(car.price),
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url,
      seller: { "@id": siteId(slug, "dealer") },
    };
  }

  return schema;
}

// ---------------------------------------------------------------------------
// buildBreadcrumbSchema — BreadcrumbList p/ rotas internas
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  /**
   * Nome visível do breadcrumb (pt-BR).
   */
  name: string;
  /**
   * URL absoluta pro item (Schema.org `item` espera URL).
   */
  item: string;
}

/**
 * `BreadcrumbList` Schema.org. Auto-incrementa `position` começando em 1.
 *
 * **NÃO injetar na home** (convenção SEO: home é raiz, breadcrumb com 1
 * item só é redundante e pode triggar warning no Rich Results Test).
 */
export function buildBreadcrumbSchema(
  items: BreadcrumbItem[],
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

// ---------------------------------------------------------------------------
// buildSitewideGraph — @graph que vai no layout (1 script por site)
// ---------------------------------------------------------------------------

/**
 * `@graph` consolidado do layout — emite AutoDealer + WebSite +
 * Organization + LocalBusiness num único `<script>` JSON-LD.
 *
 * Linking via `@id` (sem duplicar `@context` nos nodes — esse vai no
 * root do graph). Rich Results Test valida cross-references.
 *
 * **Ordem fixa** (necessária pra snapshot/test estável): dealer → website
 * → org → localbusiness. WebSite vai depois de AutoDealer porque é a
 * entidade-raiz "site público" enquanto AutoDealer é o produto principal
 * (auto-listing > publisher entity).
 */
export function buildSitewideGraph(variables: SchemaInput): {
  "@context": "https://schema.org";
  "@graph": Array<Record<string, unknown>>;
} {
  // Builders retornam node com `@context` no topo — removemos antes de
  // colocar no `@graph` (per spec JSON-LD: `@context` só no root).
  const stripContext = (node: JsonLdNode): Record<string, unknown> => {
    const copy: Record<string, unknown> = { ...node };
    delete copy["@context"];
    return copy;
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      stripContext(buildAutoDealerSchema(variables)),
      stripContext(buildWebSiteSchema(variables)),
      stripContext(buildOrganizationSchema(variables)),
      stripContext(buildLocalBusinessSchema(variables)),
    ],
  };
}
