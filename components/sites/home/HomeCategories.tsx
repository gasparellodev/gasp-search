import "server-only";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { slugify } from "@/lib/utils/slug";
import type { SiteVariables } from "@/types/lead-site";

interface HomeCategoriesProps {
  /** Categorias da Home — sempre length 3 (`SiteVariables.home_categories`). */
  categories: SiteVariables["home_categories"];
  /** Slug do site, usado pra construir o href de cada card. */
  slug: string;
}

/**
 * Bloco de Categorias da Home (Phase 7 — issue #162).
 *
 * Server Component. Grid 3-cols desktop / 1-col mobile, com cada card
 * linkando para `/sites/<slug>/estoque?categoria=<slugify(label)>`.
 *
 * **Filtro `?categoria=`**: a página `/estoque` (#164) é responsável por
 * suportar o querystring. Se ainda não suportar quando este componente
 * mergear, links abrem a listagem completa — fallback safe, sem 404.
 */
export function HomeCategories({ categories, slug }: HomeCategoriesProps) {
  return (
    <section
      data-testid="home-categories"
      className="w-full bg-background"
      aria-labelledby="home-categories-title"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <h2
          id="home-categories-title"
          className="mb-8 text-2xl font-semibold tracking-tight text-foreground md:mb-10 md:text-3xl"
        >
          Categorias em destaque
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {categories.map((category) => {
            const categorySlug = slugify(category.label);
            return (
              <li key={category.label}>
                <Link
                  href={`/sites/${slug}/estoque?categoria=${categorySlug}`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                >
                  <Image
                    src={category.image_url}
                    alt={`Categoria ${category.label}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    unoptimized
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-5 py-4 text-white md:px-6 md:py-5">
                    <span className="text-lg font-semibold md:text-xl">
                      {category.label}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-6 transition group-hover:translate-x-1"
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
