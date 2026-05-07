# Gasp Search

Aplicação web interna do GaspLab para captação, qualificação e gestão de leads voltada ao desenvolvimento de sites e automação para clientes.

> Documentação completa em construção. Veja `CLAUDE.md` para spec técnica do projeto e [issues](https://github.com/gasparellodev/gasp-search/issues) para o roadmap.

## Stack

- Next.js 14 (App Router) + TypeScript strict
- Supabase (Postgres + Auth + RLS)
- shadcn/ui + Tailwind
- Apify (`apify-client`)
- Anthropic SDK (`claude-sonnet-4-6`)
- Vitest + React Testing Library + Playwright

## Setup

```bash
npm install
cp .env.local.example .env.local
# preencher chaves Supabase / Apify / Anthropic
npm run dev
```

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run lint` — ESLint
- `npm test` — Vitest unit/integration
- `npm run test:e2e` — Playwright E2E

## Contribuindo

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) para o fluxo de PR e gates de merge.
