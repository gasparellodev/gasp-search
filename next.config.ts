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
};

export default nextConfig;
