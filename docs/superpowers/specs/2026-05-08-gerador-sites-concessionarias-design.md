# Gerador de sites pra leads — Vertical concessionárias (design)

| Campo | Valor |
|---|---|
| Status | **Approved for implementation** |
| Owner | Vinícius (GaspLab) |
| Escrito | 2026-05-08 |
| Brainstorm | `~/.claude/plans/eu-tenho-a-seguinte-moonlit-kay.md` |
| Figma source | `Touring Cars (Community)` — fileKey `g2rNyep5Y66GczfX2Ad6hO` |

---

## 1. Resumo executivo

Construir feature no gasp-search que, dado um lead de concessionária/loja de carro, gera um **site personalizado pré-pronto** (logo, cores, fotos, copy via IA) e envia o link via WhatsApp como isca de venda. Tese: lead que recebe site **já com a cara da loja** converte muito melhor do que pitch frio.

**MVP em uma frase:** botão "Gerar site" na ficha do lead → 10s depois aparece URL pública `gasp-search.com/sites/{slug}` → botão "Enviar via WhatsApp" dispara mensagem com o link.

---

## 2. Tese de negócio

- Vinícius já tem ~milhares de leads de concessionárias capturados via Apify (Google Maps + Instagram).
- ~70% não têm site, ou têm site velho/feio/sem SEO.
- Pitch atual: "Olá, vi que você não tem site. Por R$ X, faço pra você."
- Pitch novo: **"Olá, vi que você não tem site. Já fiz um pra você. [link]. Por R$ X, fica seu."**
- Custo de produção precisa ser <R$ 1 por lead (margem em ticket pequeno).

Vertical inicial: **concessionárias / lojas de carros / revendedoras**. Outras verticais ficam pra depois.

---

## 3. Decisões de arquitetura

| Eixo | Decisão | Razão |
|---|---|---|
| **URL** | `/sites/[slug]` em `gasp-search.com` | Zero infra extra. Privacy-by-obscurity já basta. Subdomínio próprio fica pra V2 se conversões pedirem. |
| **Render** | ISR via Next 16 Cache Components (`use cache` + `cacheTag` + `cacheLife`) | Primeira request paga; subsequentes voam. Invalidar com `updateTag('site:{slug}')` na edição. |
| **Acesso** | Público com slug aleatório (`nanoid8 + business-slug`) | Sem login, sem fricção. Slug `j7k2p9-toyota-recife` já dá privacidade-por-obscuridade. |
| **Gatilho de geração** | Manual: botão na ficha do lead | Volume MVP baixo. Custo previsível. Bulk vira V2 quando justificar. |
| **Copy** | 100% IA via 1 prompt master (Anthropic Sonnet 4.6 + tool use + Zod) | Cada site único. Custo ~R$0,03-0,06 com prompt cache. |
| **Brand assets** | Best-effort cascata + manual override | Pipeline nunca falha; pior caso = site genérico funcional. |
| **Cor primária** | `node-vibrant` no logo + WCAG contrast | Auto-extrai paleta. Fallback `#0C0C0C`. |
| **Mobile** | Responsive único (Tailwind breakpoints) | 1 código, 1 manutenção. Mobile do Figma só como referência visual abaixo de `md`. |
| **Detalhe carro no preview** | Stock placeholder (4-6 carros realistas) | Decisão de produto: catálogo real só após venda. |
| **Categorias da Home** | Configurável; IA infere ("0km/Seminovos/Promoção" vs "Combustão/Híbrido/Elétrico") | Adapta a perfil do lead. |
| **Tracking de visitas** | MVP-2 | Não bloqueia geração+envio. |

### Stack alocado

- **Render:** Next 16 App Router + React 19 (já no projeto).
- **Cache:** `unstable_cacheTag`, `unstable_cacheLife` do Next 16.
- **DB:** Supabase Postgres + RLS (já no projeto).
- **IA:** `lib/ai/anthropic.ts` (já existe). Modelo `claude-sonnet-4-6`. Tool use forçado.
- **Brand color:** `node-vibrant` (nova dep).
- **WhatsApp:** Evolution API via `lib/whatsapp/` (já existe).
- **Slug ID:** `nanoid` (nova dep, custom alphabet).

---

## 4. Modelo de dados

### Tabela `lead_sites`

```sql
-- supabase/migrations/0010_lead_sites.sql
create table public.lead_sites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  slug        text not null,
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'sent', 'archived')),
  variables   jsonb not null default '{}'::jsonb,
  generation_error text,
  generated_at  timestamptz,
  published_at  timestamptz,
  sent_at       timestamptz,
  view_count    integer not null default 0,
  last_viewed_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index lead_sites_user_lead_uniq on public.lead_sites(user_id, lead_id);
create unique index lead_sites_slug_uniq on public.lead_sites(slug);
create index lead_sites_user_status_idx on public.lead_sites(user_id, status);

alter table public.lead_sites enable row level security;

create policy lead_sites_select on public.lead_sites
  for select using (auth.uid() = user_id);
create policy lead_sites_insert on public.lead_sites
  for insert with check (auth.uid() = user_id);
create policy lead_sites_update on public.lead_sites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lead_sites_delete on public.lead_sites
  for delete using (auth.uid() = user_id);

create trigger lead_sites_set_updated_at before update on public.lead_sites
  for each row execute function public.set_updated_at();
```

**Acesso público em `/sites/[slug]`** usa `service_role` key server-only (single-purpose query, read-only por slug global único, jamais expõe o client).

### Schema das `variables` (JSONB) — `types/lead-site.ts`

```ts
import { z } from 'zod';

export const SiteCar = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  brand: z.string(), model: z.string(),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  km: z.number().int().min(0),
  price: z.number().positive().nullable(),
  transmission: z.enum(['Manual', 'Automático', 'CVT', 'Outros']),
  fuel: z.enum(['Gasolina', 'Etanol', 'Flex', 'Diesel', 'Híbrido', 'Elétrico']),
  color: z.string(),
  description: z.string().min(80).max(800),
  thumbnail_url: z.string().url(),
  gallery_urls: z.array(z.string().url()).min(3).max(8),
  datasheet: z.array(z.tuple([z.string(), z.string()])),
  featured: z.boolean(),
});

export const SiteVariables = z.object({
  // Globais
  business_name: z.string().min(1).max(80),
  business_slug: z.string().regex(/^[a-z0-9-]+$/),
  slogan: z.string().min(10).max(120),
  primary_color: z.string().regex(/^#[0-9a-f]{6}$/i),
  text_on_primary: z.enum(['#FFFFFF', '#0C0C0C']),
  logo_url: z.string().url(),
  whatsapp: z.string().regex(/^\d{10,13}$/),
  phone_display: z.string(),
  email: z.string().email().nullable(),
  instagram_url: z.string().url().nullable(),
  facebook_url: z.string().url().nullable(),
  youtube_url: z.string().url().nullable(),
  address_line: z.string().nullable(),
  hours: z.string().nullable(),

  // Home
  hero_image_url: z.string().url(),
  home_categories: z.array(z.object({
    label: z.string().min(2).max(30),
    image_url: z.string().url(),
  })).length(3),
  emphasis: z.object({
    title: z.string(),
    car_name: z.string(),
    description: z.string().min(50).max(400),
    image_url: z.string().url(),
  }),
  recent_sales: z.array(z.object({
    car_name: z.string(),
    image_url: z.string().url(),
  })).length(3),

  // Sobre
  about_text: z.string().min(200).max(1500),
  about_image_url: z.string().url(),
  mission: z.string().min(40).max(200),
  vision: z.string().min(40).max(200),
  values: z.array(z.string().min(8).max(80)).min(4).max(8),

  // Contato
  contact_hero_image_url: z.string().url(),

  // Estoque
  cars: z.array(SiteCar).min(4).max(6),

  // Metadata
  generated_by: z.literal('claude-sonnet-4-6'),
  generation_version: z.string(),
});
export type SiteVariables = z.infer<typeof SiteVariables>;
```

### Estados e transições

```
draft → published → sent → archived
  ↑          ↓
  └─ regenerate ─┘
```

| Status | Visitante de `/sites/[slug]` vê | Ação possível na ficha |
|---|---|---|
| `draft` | 404 | "Gerar site" |
| `published` | site renderizado | "Pré-visualizar" / "Editar" / "Regerar" / "Enviar via WhatsApp" |
| `sent` | site renderizado + (futuramente) tracking | "Reenviar" / "Editar" / "Regerar" |
| `archived` | 410 Gone | "Restaurar" |

---

## 5. Pipeline de brand assets

```ts
// lib/sites/brand-assets.ts
async function extractBrandAssets(lead: Lead): Promise<AssetSources> {
  const logo_url =
    await tryInstagramAvatar(lead.instagram_handle)        // Apify
    ?? await tryGoogleMapsProfilePhoto(lead.maps_place_id) // Apify
    ?? await tryWebsiteFavicon(lead.website)               // <link rel=icon>
    ?? buildMonogramLogo(lead.business_name);              // SVG → Vercel Blob

  const palette = await Vibrant.from(logo_url).getPalette();
  const primary_color = pickAccent(palette);
  const text_on_primary = wcagContrast(primary_color);

  const photos = await fetchMapsPhotos(lead.maps_place_id, 5);
  const [hero, about, contact] = photos.length >= 3
    ? photos
    : [...photos, ...stockShowroomPhotos.slice(0, 3 - photos.length)];

  const car_placeholder_urls = pickCarStock({
    business_type: 'concessionaria',
    count: 6,
  });

  return { logo_url, primary_color, text_on_primary,
           hero_image_url: hero, about_image_url: about,
           contact_hero_image_url: contact, car_placeholder_urls };
}
```

**Pipeline nunca falha.** Se nada funciona → monogram + cor preta + fotos stock.

**Stock photos curado** em `public/sites/stock/cars/` (issue separada, ver §9).

---

## 6. Geração de copy via IA

```ts
// lib/sites/generate-copy.ts
const SYSTEM_PROMPT = /* md */ `
Você é um copywriter especialista em sites de concessionárias brasileiras.

REGRAS DURAS:
1. Use APENAS fatos fornecidos no input. NUNCA invente histórico, anos de
   experiência, números de carros vendidos, prêmios.
2. Missão/visão/valores: frases genéricas de concessionária honesta.
3. Slogan: 3-7 palavras, sem clichê.
4. about_text: 4 parágrafos curtos (50-90 palavras cada).
5. Carros placeholder: descrições realistas baseadas em modelo+ano+km, sem
   citar opcionais não-informados.
6. home_categories: 3 categorias inferidas do perfil (luxo → "Combustão/
   Híbrido/Elétrico"; popular → "0km/Seminovos/Promoção"; picape →
   "Picapes/4x4/Diesel").

OUTPUT: ferramenta emit_site_copy. PT-BR. Acentuação correta. Sem emojis.
`;

await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  system: [{ type: 'text', text: SYSTEM_PROMPT,
             cache_control: { type: 'ephemeral' } }],
  tools: [{ name: 'emit_site_copy', input_schema: zodToJsonSchema(SiteCopySchema) }],
  tool_choice: { type: 'tool', name: 'emit_site_copy' },
  messages: [{ role: 'user', content: JSON.stringify(leadData) }],
});
```

Output validado runtime via `SiteCopySchema.parse(toolUse.input)`. `generation_version: 'v1.0.0'` salvo em `variables` — bump quando schema/prompt mudar.

**Custo:** ~R$0,03-0,06 por site (Sonnet 4.6 + cache).

---

## 7. Slug strategy

```ts
// lib/sites/slug.ts
import { customAlphabet } from 'nanoid';
const nanoid = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 8);

export async function generateUniqueSlug(business_name: string): Promise<string> {
  const base = slugify(business_name).slice(0, 30);
  for (let i = 0; i < 5; i++) {
    const candidate = `${nanoid()}-${base}`;
    const { count } = await supabase
      .from('lead_sites').select('id', { count: 'exact', head: true })
      .eq('slug', candidate);
    if (count === 0) return candidate;
  }
  throw new Error('Failed to generate unique slug');
}
```

Alphabet sem `0/o/1/i/l` pra legibilidade quando alguém ler em voz alta. Prefixo aleatório vem antes do nome porque WhatsApp encurta a partir do início.

---

## 8. Renderização

### Rota dinâmica

```tsx
// app/sites/[slug]/page.tsx
import { unstable_cacheTag as cacheTag, unstable_cacheLife as cacheLife }
  from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/service';

async function getSite(slug: string) {
  'use cache';
  cacheTag(`site:${slug}`);
  cacheLife({ revalidate: 3600, expire: 86400 });

  const { data } = await createServiceRoleClient()
    .from('lead_sites')
    .select('id, slug, status, variables')
    .eq('slug', slug).single();

  if (!data || data.status === 'archived' || data.status === 'draft') return null;
  return data;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();
  return <SitePage variables={site.variables} siteId={site.id} />;
}
```

### Componente `<SitePage>`

Server Component em `components/sites/SitePage.tsx`. Recebe `variables: SiteVariables`, monta header/sections em ordem fixa. Cada seção é um sub-componente:

- `<SiteHeader variables={...} activePage={...} />`
- `<HomeHero />`, `<HomeCategories />`, `<HomeForm />`, `<HomeEmphasis />`, `<HomeRecentSales />`
- `<AboutSection />`, `<ContactSection />`, `<AnnounceSection />`, `<StockSection />`, `<CarDetailSection />`
- `<SiteFooter />`

Páginas adicionais (`/sites/[slug]/sobre`, etc.) são rotas filhas reusando os mesmos componentes.

### Tracking de views (MVP-2)

Out of scope. Adicionar `view_count` increment via Server Action debounced quando entrar.

---

## 9. UX na ficha do lead

Componente novo `<LeadSiteCard />` em `app/(app)/leads/[id]/page.tsx`. Estados:

```
draft:
  Nenhum site gerado ainda.
  [ Gerar site agora ]

published / sent:
  ✓ Gerado em <data>
  URL: gasp-search.com/sites/<slug> [copy]
  [ Pré-visualizar ↗ ] [ Editar ] [ Regerar ]
  [ Enviar via WhatsApp ]   (se published)
  [ Reenviar ]              (se sent)
```

**Loading:** botão vira `<Spinner /> Gerando... (~10-15s)`. Toast `sonner` no fim.

**Modal "Editar":** full-screen, `react-hook-form` + Zod, sections (Globais / Home / Sobre / Estoque / Carros). Save → `updateLeadSiteVariables` → `updateTag('site:{slug}')`.

---

## 10. Server Actions

```
app/(app)/leads/[id]/actions.ts
├── generateLeadSite(leadId)            // brand assets + IA + upsert + cache warm
├── updateLeadSiteVariables(siteId, patch) // Zod validate + update + invalidate
├── regenerateLeadSite(siteId)          // = generate + status='published'
├── sendLeadSiteWhatsApp(siteId)        // render template + Evolution API + status='sent'
└── archiveLeadSite(siteId)             // status='archived' + invalidate
```

Tudo `'use server'`. Auth via `requireUser()`. RLS garante isolamento.

---

## 11. Integração WhatsApp

```ts
// lib/whatsapp/templates/site-preview.ts
export const SITE_PREVIEW_TEMPLATE = /* md */ `
Olá! Tudo bem?

Vi que vocês da {business_name} ainda não têm site (ou tá desatualizado, sem SEO).

Desenvolvi uma página personalizada pra vocês:

{site_url}

Dá uma olhada — leva 30s pra navegar. Se gostarem, deixo pronto pra publicar
com o domínio de vocês por **R$ 1.199,99**.

Qualquer coisa, é só responder por aqui.

— Vinícius / GaspLab
`;
```

Hook em `lib/campaigns/processor.ts` aceita novo tipo `'site_preview'` que itera leads com `lead_sites.status = 'published'`. Throttle existente + guard hard-coded de **máx 50 sends/dia/instância Evolution API** (anti-ban).

---

## 12. Variáveis de ambiente novas

Nenhuma. Reutiliza `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `EVOLUTION_API_*`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 13. Quality gates (do CLAUDE.md)

- TDD obrigatório em `lib/sites/*` (mappers, generators, slug, brand-assets).
- E2E com Playwright pra fluxo "Gerar → Pré-visualizar → Editar → Enviar".
- Coverage ≥ 80% lines/functions, ≥ 75% branches em `lib/sites/` e `app/sites/`.
- Lint zero warnings; typecheck zero erros.
- `sentry-skills:code-review` + `security-review` em cada PR.
- CLAUDE.md de cada pasta tocada atualizado.
- 1 review aprovado + squash merge.

### Riscos de segurança a auditar (security-review)

1. **`service_role` em rota pública.** Helper deve ser single-purpose, server-only, sem exportar o client. Confirmar que nenhum import vaza pro bundle do client.
2. **RLS bypass auditado** com tests integrados (criar lead+site como user A, garantir que user B não consegue ler/editar).
3. **Anti-XSS na rota pública.** Variáveis vêm de IA — sanitizar `business_name`, `slogan`, `about_text`, `description` antes de injetar (React faz por padrão, mas confirmar que não tem `dangerouslySetInnerHTML`).
4. **Rate limit do botão "Gerar".** Limite N gerações/min/user pra evitar burn de Anthropic.
5. **Logs sem PII.** Nunca logar `whatsapp`, `email`, `address` em telemetria.

---

## 14. Implementação — milestones e issues criadas

Milestone GitHub: **[Phase 7 — Site Generator (Concessionárias)](https://github.com/gasparellodev/gasp-search/milestone/8)**

Labels novos: `area:sites`, `phase:7`, `needs:visual-validation`.

### M1 — Infra de dados e geração

| ID | Issue | Título |
|---|---|---|
| M1.1 | [#153](https://github.com/gasparellodev/gasp-search/issues/153) | feat(sites): migration `lead_sites` + RLS + types gerados |
| M1.2 | [#154](https://github.com/gasparellodev/gasp-search/issues/154) | feat(sites): `SiteVariables` Zod schema em `types/lead-site.ts` |
| M1.3 | [#155](https://github.com/gasparellodev/gasp-search/issues/155) | feat(sites): slug generator com nanoid + dedup contra DB |
| M1.4 | [#156](https://github.com/gasparellodev/gasp-search/issues/156) | feat(sites): pipeline de brand assets (logo cascata + cor + fotos) |
| M1.5 | [#157](https://github.com/gasparellodev/gasp-search/issues/157) | chore(sites): banco curado de stock photos pra catálogo placeholder |
| M1.6 | [#158](https://github.com/gasparellodev/gasp-search/issues/158) | feat(sites): `generateCopy` via Anthropic Sonnet com tool use + Zod |
| M1.7 | [#159](https://github.com/gasparellodev/gasp-search/issues/159) | feat(sites): Server Action `generateLeadSite` (orquestrador completo) |

### M2 — Renderização pública

| ID | Issue | Título |
|---|---|---|
| M2.1 | [#160](https://github.com/gasparellodev/gasp-search/issues/160) | feat(sites): rota pública `/sites/[slug]` com Cache Components + `service_role` |
| M2.2 | [#161](https://github.com/gasparellodev/gasp-search/issues/161) | feat(sites): components globais SiteHeader + SiteFooter + SiteForm |
| M2.3 | [#162](https://github.com/gasparellodev/gasp-search/issues/162) | feat(sites): components Home (Hero + Categories + Emphasis + RecentSales) |
| M2.4 | [#163](https://github.com/gasparellodev/gasp-search/issues/163) | feat(sites): páginas Sobre + Contato + Anunciar |
| M2.5 | [#164](https://github.com/gasparellodev/gasp-search/issues/164) | feat(sites): páginas Estoque (lista + filtro) e Detalhe-do-carro |
| M2.6 | [#165](https://github.com/gasparellodev/gasp-search/issues/165) | feat(sites): `generateMetadata` + OG + noindex + responsive completo |
| M2.7 | [#166](https://github.com/gasparellodev/gasp-search/issues/166) | test(sites): E2E Playwright cobrindo geração + render + navegação |

### M3 — UI na ficha do lead

| ID | Issue | Título |
|---|---|---|
| M3.1 | [#167](https://github.com/gasparellodev/gasp-search/issues/167) | feat(sites): `LeadSiteCard` com 4 estados na ficha do lead |
| M3.2 | [#168](https://github.com/gasparellodev/gasp-search/issues/168) | feat(sites): modal de edição manual das variáveis (react-hook-form + Zod) |
| M3.3 | [#169](https://github.com/gasparellodev/gasp-search/issues/169) | feat(sites): ações Regerar + Arquivar + Restaurar no `LeadSiteCard` |

### M4 — Envio WhatsApp

| ID | Issue | Título |
|---|---|---|
| M4.1 | [#170](https://github.com/gasparellodev/gasp-search/issues/170) | feat(sites): template `SITE_PREVIEW_TEMPLATE` + helper `renderTemplate` |
| M4.2 | [#171](https://github.com/gasparellodev/gasp-search/issues/171) | feat(sites): Server Action `sendLeadSiteWhatsApp` + Evolution API |
| M4.3 | [#172](https://github.com/gasparellodev/gasp-search/issues/172) | feat(sites): hook em `campaigns/processor` pra tipo `site_preview` |
| M4.4 | [#173](https://github.com/gasparellodev/gasp-search/issues/173) | feat(sites): guard hard 50 sends/dia/instância (anti-ban WhatsApp) |

### Diagrama de dependências

```
M1.1 (migration)
  ├─ M1.2 (Zod) ─┬─ M1.6 (IA copy) ─┐
  │              └─ M2.1 (rota) ─┐  │
  ├─ M1.3 (slug) ────────────────┼──┤
  └─ M1.5 (stock) → M1.4 (assets)┼──┤
                                  │  │
                                 M1.7 (generateLeadSite)
                                  │
            ┌─────────────────────┼─────────────────┐
            │                     │                 │
        M2.7 (E2E)           M3.1 (Card)        M4.2 (send)
                                  │                 │
                              M3.2, M3.3        M4.3 → M4.4

M2.2 (globals) ─┬─ M2.3 (Home) ─┐
                ├─ M2.4 (Sobre/Contato/Anunciar) ─┼─ M2.6 (meta)
                └─ M2.5 (Estoque/Detalhe) ───────┘

M4.1 (template) → M4.2
```

### Pós-MVP (não bloqueia release; sem issues abertas ainda)

- Tracking de views (`site_views` table + Server Action debounced + métrica na UI).
- Bulk generation (selecionar N leads, gerar em fila com Vercel Queues).
- Subdomínio próprio `{slug}.gaspsites.app` (wildcard DNS + Routing Middleware).
- Suporte a outras verticais (clínicas, salões, etc.).

---

## 15. Verification

Implementação termina quando:

1. ✅ Migration aplicada em Supabase (dev + prod schema).
2. ✅ Todas as tasks dos Milestones 1-4 fechadas com testes verdes.
3. ✅ Coverage targets atingidos.
4. ✅ E2E Playwright cobre: lead → gerar site → editar 2 campos → enviar WhatsApp → verificar status.
5. ✅ Security review: `service_role` confinado, RLS bypass testado, XSS sanitization confirmada, rate limit ativo.
6. ✅ Vinícius gera 5 sites de leads reais e envia via WhatsApp em produção sem erros.
7. ✅ Custo médio por site ≤ R$ 0,10 (Anthropic + Apify).

---

## 16. Open questions (não-bloqueiam implementação)

- **Subdomínio próprio:** quando volume justificar (>20 sites enviados/dia), reavaliar (B) `{slug}.gaspsites.app`.
- **Edição WYSIWYG:** modal atual é form-based. Se Vinícius pedir edição visual depois, considerar lib (TipTap, etc.).
- **Multi-vertical:** estrutura atual é específica de concessionária. Generalizar pra clínica/salão/restaurante exige novo schema + Figma + prompt.
- **Aprovação do cliente final:** quando lead fecha venda, qual fluxo de upload de inventário real? Provavelmente CSV upload + UI manual de carro-a-carro. Definir no momento.

---

## 17. Trabalho prévio e gates

### Antes de qualquer PR
- [ ] **Curar 30 fotos stock de carros** em `public/sites/stock/cars/` (issue separada — bloqueia M1).

### Decisões já confirmadas
- ✅ Valor do pitch WhatsApp: **R$ 1.199,99** (gravado em §11).
- ✅ **Token Figma vazado: mantido propositalmente até o fim da implementação** (decisão do owner em 2026-05-08). Hardening fica pra pós-implementação na §17.

### Após implementação (pós-MVP)
- [ ] **Revogar e regerar token Figma.** Atualizar config MCP local: `claude mcp remove figma --scope user && claude mcp add figma --scope user -- npx -y figma-developer-mcp --figma-api-key=NOVO_TOKEN --stdio` (espaço antes de `--stdio` é obrigatório). Não colar o novo token em chat.
- [ ] **Validar custo médio real por site** vs target (≤ R$ 0,10 Anthropic + Apify).
- [ ] **Abrir issue follow-up** pra subdomínio próprio se conversões justificarem.

---

## 18. Workflow multi-papel e validação visual

Cada issue desta spec passa por **4 papéis virtuais** antes do merge. Detalhamento completo em [`PROCESS-multi-role-validation.md`](./PROCESS-multi-role-validation.md).

| Papel | Quando atua | Output |
|---|---|---|
| **Product Owner** | Antes do dev: refina AC; depois do dev: valida contra requisitos | ✅ AC checklist marcada |
| **Developer** | Implementa | PR com código + testes + CLAUDE.md atualizado |
| **QA Tester** | Após dev: testa funcional + visual contra Figma | ✅ Test report + screenshots de diff visual |
| **Code Reviewer** | Final: code review + security review | ✅ `sentry-skills:code-review` + `security-review` rodados |

### Validação visual obrigatória pra issues de UI

Issues marcadas com `type:ui` (toda M2 e parte da M3) exigem **visual diff vs Figma**:

1. QA exporta o frame Figma correspondente como PNG via `mcp__figma__download_figma_images`.
2. Playwright captura screenshot da implementação em viewport desktop (1906px) e mobile (375px).
3. Comparação lado-a-lado em report do PR (artifact). Tolerância: pixel-diff ≤ 5% **OU** justificativa explícita das diferenças (ex: "logo é parametrizável, não há ground truth").
4. Issue não pode ser fechada sem o report.

Ferramentas: `seo-visual` skill (Playwright wrapper) ou Storybook + Chromatic se quisermos investir.
