/**
 * Componente Server que renderiza o conteúdo da Política de Privacidade LGPD
 * (Phase 7 / Frente 05 Premium Pass — issue #P10).
 *
 * Acessibilidade:
 *  - `<article aria-labelledby="lgpd-heading">` envolve todo o conteúdo.
 *  - `<h1 id="lgpd-heading">` é a âncora do aria-labelledby.
 *  - `<nav aria-label="Sumário">` fornece skip-nav para leitores de tela.
 *  - Cada seção tem `<section id={section.id} aria-labelledby={...}>`.
 *  - Foco visível em links de âncora via classe `focus-visible:ring`.
 *
 * Design:
 *  - Light theme conform (sem dark: classes).
 *  - Tipografia generosa: `prose` base + espaçamento entre seções.
 *  - TOC compacto no topo com links âncora para cada seção.
 */

import type { LgpdSection } from "@/lib/sites/lgpd-content";
import { formatUpdateDate } from "@/lib/sites/lgpd-content";

interface LgpdContentProps {
  sections: LgpdSection[];
  businessName: string;
}

export function LgpdContent({ sections, businessName }: LgpdContentProps) {
  const updateDate = formatUpdateDate();

  return (
    <article
      aria-labelledby="lgpd-heading"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16"
    >
      {/* Título principal */}
      <header className="mb-10">
        <h1
          id="lgpd-heading"
          className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
        >
          Política de Privacidade
          <span className="mt-2 block text-xl font-medium text-gray-500 sm:text-2xl">
            {businessName}
          </span>
        </h1>
        <p className="mt-4 text-sm text-gray-500">
          Lei nº 13.709/2018 — Lei Geral de Proteção de Dados (LGPD)
        </p>
      </header>

      {/* Sumário (table of contents / skip-nav) */}
      <nav
        aria-label="Sumário da Política de Privacidade"
        className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-5"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
          Nesta página
        </p>
        <ol className="space-y-1.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Seções da política */}
      <div className="space-y-12">
        {sections.map((section) => {
          const headingId = `${section.id}-heading`;
          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={headingId}
              className="scroll-mt-24"
            >
              <h2
                id={headingId}
                className="mb-4 text-xl font-semibold text-gray-900"
              >
                {section.heading}
              </h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph, pIndex) => (
                  <p
                    key={pIndex}
                    className="whitespace-pre-line text-sm leading-relaxed text-gray-700"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Rodapé da política */}
      <footer className="mt-12 border-t border-gray-200 pt-6">
        <p className="text-xs text-gray-400">
          Última atualização:{" "}
          <time dateTime={new Date().toISOString().split("T")[0]}>
            {updateDate}
          </time>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {businessName} — todos os direitos reservados.
        </p>
      </footer>
    </article>
  );
}
