import "server-only";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface HomeCategoriesCarsProps {
  /** Slug do site — usado pra construir o href de cada card. */
  slug: string;
  /**
   * URLs de fotos de categoria, indexadas por posição (do manifest AI
   * persistido em `lead_sites.visual_identity.categories_urls`). Ordem
   * estável segue `CATEGORY_INDEX` (suv=0, sedan=1, hatch=2, pickup=3,
   * esportivo=4, conversivel=5).
   *
   * Caller (`SitePage`) já fez o `manifest?.categories_urls ?? null`. Esta
   * camada só consome o array — entradas ausentes/null por posição caem
   * em placeholder SVG inline (degradação gracefulm).
   */
  manifestCategoriesUrls: ReadonlyArray<string> | null | undefined;
}

/**
 * Categorias canônicas V1 (ordem == posição no manifest AI).
 *
 * Ordem segue `lib/sites/visual-identity.ts:CAR_CATEGORIES` (espelha o
 * enum `SiteCar.category`) e o índice de manifest gerado em #216:
 *   - 0: SUV
 *   - 1: Sedan
 *   - 2: Hatch
 *   - 3: Pickup
 *   - 4: Esportivo
 *   - 5: Conversível
 */
type CategoryLabel =
  | "SUV"
  | "Sedan"
  | "Hatch"
  | "Pickup"
  | "Esportivo"
  | "Conversível";

interface CategoryDef {
  /** Label exibido no overlay (PT-BR). */
  label: CategoryLabel;
  /** Slug `?bodyType=<slug>` consumido pelo filtro de /estoque (#224 E1). */
  bodyType: string;
  /** Plural em PT-BR para o aria-label "Ver Xs no estoque". */
  pluralAria: string;
}

/**
 * `BODY_TYPE_QUERY` canônico (PO refinement #221).
 *
 * Slugs alinhados com tabela compartilhada com #224 (E1). PT-BR labels →
 * en-US slug curto na query string (mais conciso pra share).
 */
const CATEGORIES: ReadonlyArray<CategoryDef> = [
  { label: "SUV", bodyType: "suv", pluralAria: "SUVs" },
  { label: "Sedan", bodyType: "sedan", pluralAria: "Sedans" },
  { label: "Hatch", bodyType: "hatch", pluralAria: "Hatches" },
  { label: "Pickup", bodyType: "pickup", pluralAria: "Pickups" },
  { label: "Esportivo", bodyType: "sport", pluralAria: "Esportivos" },
  { label: "Conversível", bodyType: "convertible", pluralAria: "Conversíveis" },
];

/**
 * Placeholder inline (SVG data URI) — usado quando manifest ausente
 * em uma posição. Sem hit pra rede, sem CLS extra, contraste mínimo
 * com o fundo do card.
 */
const PLACEHOLDER_DATA_URI =
  "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%204%203%22%3E%3Crect%20width%3D%224%22%20height%3D%223%22%20fill%3D%22%23e6e6e6%22%2F%3E%3C%2Fsvg%3E";

/**
 * Bloco "Categorias" da Home (Phase 7 / Sprint 4 / #H1 — issue #221).
 *
 * Server Component. 6 cards 4:3 com foto + label overlay. Mobile: scroll
 * horizontal `snap-x snap-mandatory`. Desktop: grid 6 cols.
 *
 * Cards inteiros são clicáveis (`<Link>` envolve a foto + label) →
 * `/sites/<slug>/estoque?bodyType=<slug>` per `BODY_TYPE_QUERY` canônico
 * (compartilhado com #224 / E1). `aria-label` descritivo no link cobre
 * a11y de leitor de tela.
 */
export function HomeCategoriesCars({
  slug,
  manifestCategoriesUrls,
}: HomeCategoriesCarsProps) {
  const urls = manifestCategoriesUrls ?? [];

  return (
    <section
      data-testid="home-categories-cars"
      data-reveal
      className="w-full bg-background"
      aria-labelledby="home-categories-cars-title"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <h2
          id="home-categories-cars-title"
          className="mb-8 text-2xl font-semibold tracking-tight text-foreground md:mb-10 md:text-3xl"
        >
          Encontre seu próximo carro
        </h2>
        <ul
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scroll-padding-left:1rem] md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0 md:[scroll-padding-left:0]"
        >
          {CATEGORIES.map((category, index) => {
            const photoUrl = urls[index] ?? PLACEHOLDER_DATA_URI;
            return (
              <li
                key={category.label}
                className="w-[70%] shrink-0 snap-start md:w-auto"
              >
                <Link
                  href={`/sites/${slug}/estoque?bodyType=${category.bodyType}`}
                  aria-label={`Ver ${category.pluralAria} no estoque`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  <Image
                    src={photoUrl}
                    alt={`Categoria ${category.label}`}
                    fill
                    sizes="(max-width: 768px) 70vw, 16vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    unoptimized
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-4 py-3 text-white md:px-4 md:py-3">
                    <span className="text-sm font-semibold md:text-base">
                      {category.label}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-5 transition group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
