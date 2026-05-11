import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Adoção incremental do `'use cache'` directive (Next 16).
    //
    // Em vez de `cacheComponents: true` (que requer migração de TODA a
    // app — Suspense em cada page, remover `force-dynamic`, etc.),
    // `experimental.useCache: true` habilita o directive de forma
    // opt-in: rotas que não declararem `'use cache'` continuam com a
    // semântica anterior (compatível com `dynamic = "force-dynamic"`).
    //
    // Usado em `app/sites/[slug]/page.tsx` (issue #160) para servir os
    // sites públicos via edge cache. Invalidação granular por tag:
    // `updateTag('site:<slug>')` é chamado em
    // `app/actions/lead-site.ts` após gravação/regeração.
    //
    // Migração para `cacheComponents: true` fica como follow-up V2 quando
    // o time priorizar Suspense boundaries em todas as rotas.
    useCache: true,
  },
  // -------------------------------------------------------------------------
  // Image optimization remote hosts (issue #212 / Sprint 1 / #S2 SEO infra).
  // -------------------------------------------------------------------------
  //
  // Hosts liberados para o `<Image>` otimizado do Next. **Hoje** os 11
  // callsites de `<Image>` em `components/sites/*` ainda usam `unoptimized`
  // (decisão tomada na migração V2 dos componentes, issue #206 PR-B). A
  // remoção desses `unoptimized` é **follow-up dedicado** — fora de escopo
  // desta issue.
  //
  // Quando a migração rodar, qualquer URL externa retornada pelo pipeline
  // de brand assets (`lib/sites/brand-assets.ts`) ou pelos componentes
  // de stock fotos será otimizada (AVIF/WebP, srcset responsivo) sem
  // alteração nos callsites.
  //
  // Lista canônica (9 hosts, ordem alfabética por domínio raiz):
  //   - `apify-storage.s3.amazonaws.com` — Apify KV store (Maps photos persistidas).
  //   - `*.apifyusercontent.com` — Apify scraped content (Instagram avatar, Maps photos).
  //   - `*.cdninstagram.com` — Instagram CDN (avatars, posts).
  //   - `*.fbcdn.net` — Facebook CDN (frequentemente espelha Instagram).
  //   - `instagram.com` — Instagram CDN top-level.
  //   - `lh3.googleusercontent.com` — Google avatars (Maps owners + signed-in users).
  //   - `maps.googleapis.com` — Google Maps Places photos (URL direta).
  //   - `*.supabase.co` — Supabase Storage bucket prod.
  //   - `*.supabase.in` — Supabase Storage bucket legacy/regional.
  //
  // **Manter alinhado com**: AI crawler allowlist em `app/robots.ts`,
  // baseline 2026-05; revisar trimestralmente conforme novas fontes
  // entrarem no pipeline.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "instagram.com" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "apify-storage.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.apifyusercontent.com" },
    ],
  },
};

export default nextConfig;
