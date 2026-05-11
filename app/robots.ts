/**
 * `app/robots.ts` — Next.js Metadata file `robots.txt`.
 *
 * Issue #212 / Sprint 1 / #S2 — SEO infra fundamental.
 *
 * Estratégia (baseline 2026-05, revisar trimestralmente):
 *   - **Universal `*`**: allow geral, disallow das rotas internas do app
 *     autenticado (/login, /dashboard/, /leads/, etc.) — search engines
 *     não devem indexar essas rotas.
 *   - **11 AI bots + Bingbot**: allow explícito para crawl. Os mini-sites
 *     gerados são o produto final do Site Generator; queremos que ChatGPT,
 *     Claude, Perplexity, AI Overviews citem essas páginas.
 *   - **`sitemap`**: URL absoluto (per protocolo) apontando pro
 *     `app/sitemap.ts` dinâmico.
 *   - **`host`**: hint canônico (Yandex/Bing).
 *
 * Convenção do `MetadataRoute.Robots`: cada `rule` aceita `userAgent` string
 * (não array — uma regra por bot para clareza). `disallow`/`allow` aceitam
 * string ou array — usamos array no universal.
 *
 * Sem cache directives — Next emite o arquivo no build (estático) ou a cada
 * request quando há env runtime; `NEXT_PUBLIC_APP_URL` é build-time então
 * isso é estático.
 */
import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

const INTERNAL_DISALLOW = [
  "/api/",
  "/admin/",
  "/(app)/",
  "/login",
  "/dashboard/",
  "/leads/",
  "/messages/",
  "/campaigns/",
  "/pipeline/",
  "/search/",
];

const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "ChatGPT-User",
  "GoogleOther",
  "Google-Extended",
  "Bytespider",
  "CCBot",
  "anthropic-ai",
  "cohere-ai",
  "FacebookBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const universalRule = {
    userAgent: "*",
    allow: "/",
    disallow: INTERNAL_DISALLOW,
  };

  const aiBotRules = AI_CRAWLERS.map((ua) => ({
    userAgent: ua,
    allow: "/",
  }));

  // Bingbot — explícito (allow), também alvo do `host` hint.
  const bingbotRule = {
    userAgent: "Bingbot",
    allow: "/",
  };

  return {
    rules: [universalRule, ...aiBotRules, bingbotRule],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
