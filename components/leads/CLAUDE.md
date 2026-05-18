# `components/leads/` — Spec Técnica

## Propósito

Components de UI para a área de leads (`/leads`). A tabela principal,
seu drawer de detalhe e helpers locais.

## Como adicionar

- **Component novo**: arquivo PascalCase em kebab no nome (`lead-detail-drawer.tsx`).
  `'use client'` na primeira linha quando precisar de estado/handlers.
- **Tipos compartilhados**: importar `LeadListItem` de `@/lib/leads/list-leads`.
- **Cobrir** com unit em `tests/unit/components/leads/<arquivo>.test.tsx`.
  Página `/leads` em si fica na cobertura E2E (Playwright), não em unit.

## Regras de negócio

1. **Paginação e ordenação são server-side** via search params (`page`, `pageSize`,
   `sortBy`, `sortDir`). A tabela não mantém estado próprio de paginação — só
   atualiza a URL via `router.push`. O Server Component re-fetch.
2. **Page sizes válidos: 25, 50, 100** (mantidos em `LEAD_PAGE_SIZE_OPTIONS`).
3. **Colunas sortable**: `name`, `category`, `city`, `stage`, `score`, `created_at`.
   Outras colunas (Contato, Tags, Ações) não acionam sort.
4. **Linha clicável** abre `LeadDetailDrawer` em estado local. O botão "Abrir"
   na coluna Ações faz a mesma ação com `aria-label` por nome do lead.
5. **`LeadDetailDrawer` é wrapper Sheet sobre `<LeadTabs mode="inline">`**
   (issue #136 — convergência com `/leads/[id]/page.tsx`). O drawer fica
   apenas com header (`SheetTitle` + descrição + ícone secundário
   "abrir conversa" #137 quando `NEXT_PUBLIC_WHATSAPP_ENABLED='1'` e
   `lead.phone` está preenchido — link para `/messages/[id]`), footer
   (botão Fechar) e delega tabs/edição para `<LeadTabs />`. O hero
   header do `<LeadTabs mode="standalone">` também recebe o mesmo ícone
   "abrir conversa" sob as mesmas condições (paridade entre standalone
   e drawer).
6. **`<LeadTabs />` é a UI canônica** (issue #136): tabs **Visão geral /
   Notas / Mensagens IA / Conversa** (+ Site opcional via slot) com edição
   inline de `name`, `phone`, `stage`, `score`, `notes` e `tagIds` via PATCH
   `/api/leads/[id]`. Validação Zod (`updateLeadSchema`) roda antes de
   qualquer side effect. Estado interno é optimistic — em falha, revert +
   toast.error. `router.refresh()` é chamado em sucesso quando o componente
   usa o fetch default. A tab **Mensagens IA** renderiza a experiência real
   de geração via `MessageGenerator`; no modo standalone aceita
   `messageHistory` como slot para mostrar o histórico paginado. A tab
   **Conversa** só aparece com `NEXT_PUBLIC_WHATSAPP_ENABLED='1'`. A tab
   **Site** só aparece se o parent passa o slot `siteCard`. **Modos**:
   `inline` (encaixa em Sheet, scroll interno) vs `standalone` (hero header
   com nome/badge + spacing folgado).
6. **Bulk select + Enriquecer + Criar campanha** (issues #28, #126): cada linha
   tem checkbox; toolbar acima da tabela aparece com contagem quando há seleção.
   - "Enriquecer selecionados" dispara POST `/api/apify/enrich` com até
     `ENRICH_MAX_LEADS` (25). Toasts de loading/success/error usam o id
     `bulk-enrich` para deduplicar. `router.refresh()` após sucesso.
   - "Criar campanha" navega para `/campaigns/new?leads=<id1>,<id2>,...`
     respeitando `CAMPAIGN_MAX_LEADS` (50). Acima do limite, botão fica
     disabled com tooltip.
   - Enrich é **exclusivamente manual** — não há mais auto-enrich pós-busca.
7. **Estado vazio desenhado**: nada de tela em branco quando `leads.length === 0`.
8. **Responsividade**: filtros usam grid responsivo e inputs `w-full` em
   mobile. A tabela deve conter overflow horizontal no próprio bloco
   (`Table`/container), nunca no `body`. Drawer, tabs e popovers usam
   `max-w` baseado em viewport.
9. **Viewport da lista**: `/leads` mantém header, filtros e paginação visíveis
   dentro da tela. A rolagem vertical e horizontal da tabela acontece no
   container interno `leads-table-scroll`, não na página inteira.

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `filters-bar.tsx` | Client | Barra de filtros (q, stage, source, hasWebsite, tags multi) sincronizada com URL |
| `leads-table.tsx` | Client | Tabela TanStack com sort/pageSize/paginação via URL + drawer |
| `lead-tabs.tsx` | Client | **UI canônica** (issue #136) — 4 tabs (Visão geral / Notas / Mensagens IA / Conversa*) + Site opcional. Edição inline `name`/`phone`/`stage`/`score`/`notes`/`tagIds` com validação Zod (`updateLeadSchema`). Prop `mode='inline' \| 'standalone'`. Slots `siteCard` e `messageHistory` (ReactNode) para flexibilidade Server/Client. Override opcional `onUpdate` para testes; default usa fetch `/api/leads/[id]` + `router.refresh()`. `*` Conversa só visível com `NEXT_PUBLIC_WHATSAPP_ENABLED='1'`. |
| `lead-detail-drawer.tsx` | Client | Wrapper Sheet sobre `<LeadTabs mode="inline">` (refatorado #136). Mantém só o header (SheetTitle + descrição + ícone "abrir conversa" condicional do #137), footer (Fechar) e passa `<LeadSiteCardClient />` como slot. |
| `lead-site-card.tsx` | Server | Card "Site do lead" na ficha `/leads/[id]` (#167). Faz `select` em `lead_sites` via Supabase com RLS e renderiza 4 estados (`none`/`draft`, `published`, `sent`, `archived`). Datas formatadas com `Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })`. URL composta com `NEXT_PUBLIC_APP_URL` (nunca hardcoded). Exporta `LeadSiteCardView` puro pra unit test. |
| `site-published-modal.tsx` | Client | **Sprint B3 onsite flow.** Modal pós-publicação com QR code (240×240, lib `qrcode` import dinâmico) + URL display + botões "Copiar link" / "Abrir site" / "Enviar via WhatsApp". Auto-abre após `generateLeadSite` em sucesso (state `publishedSlug` em `<LeadSiteCardActions>`). Re-abrível via botão "QR code" no cluster publicado. URL é deduzida via `publishedSlug ?? leadSite.slug` (snapshot da última geração com fallback). |
| `lead-site-pre-gen-modal.tsx` | Client | **Sprint A1 onsite flow.** Modal de validação que aparece ANTES de disparar `generateLeadSite`. Mostra 6 fields (nome, telefone, email, website, instagram, localização) com badges ✓/⚠. **Bloqueia** geração quando faltam `name` ou `phone` (mínimo viável WhatsApp); **avisa** quando faltam opcionais. Receber `lead: PreGenLeadSummary` + `onConfirm` por DI — sem dependência de Server Action no componente. |
| `site-generation-progress.tsx` | Client | **Sprint A2 onsite flow.** Overlay com 3 estágios animados (timer-based 12s cada) que aparece durante os ~30-60s do `generateLeadSite`. **Cosmético** — não revela progresso real do pipeline; só evita que o operador feche a aba achando que travou. `role="status" aria-live="polite"`. Caller deve usar `key={isGenerating ? "active" : "idle"}` pra forçar remount entre execuções (estágios resetam de 0). TODO V2: progresso real via Supabase Realtime ou polling de `lead_sites.generation_progress` quando migrarmos pra BullMQ. |
| `lead-site-card-actions.tsx` | Client | Cluster de botões interativo do `<LeadSiteCard />`. Seis `useTransition` independentes (generate / archive / restore / send / regenerate-identity / discard) pra evitar que um spinner bloqueie outro botão. **Sprint A1/A2/A3/A4 onsite flow:** quando `leadSummary` prop está presente, clicar "Gerar site agora" abre `<LeadSitePreGenModal>` em vez de disparar a action diretamente; durante a geração, `<SiteGenerationProgress>` aparece como overlay tranquilizador. No estado `draft+error` (sprint A4 — `leadSite.status === 'draft'` AND `leadSite.generation_error !== null`), o cluster troca pra "Tentar de novo" + "Descartar rascunho" (chama `discardLeadSiteDraft`, sprint A3). Retry em draft+error **pula o modal** (operador já validou na primeira tentativa). **Estado `none`/`draft`** → "Gerar site agora". **Estado `archived`** → "Restaurar" (chama `restoreLeadSite`, #169). **Estados `published`/`sent`** → cluster com Pré-visualizar (link target=_blank), Copiar (clipboard), Editar (abre `<LeadSiteEditModal>`, #168), Regerar (chama `generateLeadSite`, #159), Arquivar (abre `<AlertDialog>` de confirmação destrutiva → confirma chama `archiveLeadSite`, #169), **Enviar via WhatsApp** (chama `sendLeadSiteWhatsApp`, #171) e **Regenerar identidade visual (#217, ATIVO)** — abre `<AlertDialog>` (texto "9 imagens com IA custando ~R$ 2,45" + "⏱ até 90 segundos") → confirma chama `regenerateVisualIdentity(siteId, {force:true})` (#216), spinner "Gerando imagens (até 90s)…", em sucesso dispara `toast.success("Identidade visual regenerada", { description: 'Custo desta geração: R$ X,XX' })` (formatado via `formatBRL(manifest.cost_estimate_brl, {fractionDigits:2})`) + `router.refresh`; em erro mapeia mensagens PT-BR via `regenerateErrorMessage` (7 codes: auth/not_found/cost_guardrail/validation/generation_error/storage_error/db_error). Toda async dispara toast `sonner` em sucesso/erro com mensagens PT-BR. Confirm dialogs (Arquivar + Regenerar identidade) usam Radix `AlertDialog` (role=alertdialog, focus trap, ESC cancela) — cobertos por jest-axe nos testes. Re-send WhatsApp permitido em status `'sent'`; re-regenerate identidade idem (`force:true` sempre). |
| `LeadSiteEditModal.tsx` | Client | Modal de edição manual das variáveis do site (#168, schema v2 desde #197 PR-C). Radix Dialog + `react-hook-form` + `zodResolver(SiteVariablesV2.partial())`. Default values vêm de `leadSite.variables` (v2 nested). Submit envia **apenas dirty fields** pra `updateLeadSiteVariables` (Server Action também v2). **Seções:** Identidade, Identidade visual (`brand_assets.*` — 6 campos nested), Sobre, Contato (com Endereço nested: 6 campos `address.*` + checkbox "indisponível" que seta `address: null`), Estoque (`cars[]` com `category` enum-select 6 opções, `doors` select 2/3/4/5 + "não informar", `vin` regex 17 chars optional, `photos[]` textarea newline-separated min 3 max 8, `plates_visible: false` **readonly + hidden** compliance). Toast `sonner` em sucesso/erro. `cars[]` editável via `useFieldArray`; a UI de add segue cap 6 do gerador inicial, enquanto o schema público aceita até 60 desde #225 para estoque paginado. URL inputs são text V1 — upload de arquivo (Vercel Blob picker) é follow-up V2. |
| `lead-site-card-types.ts` | (types) | Tipos compartilhados entre Server e Client component (`LeadSiteCardData`, `LeadSiteStatus`). Subset serializável da `Row` do Supabase — não vaza `user_id` pra Client. Inclui `variables: SiteVariablesV2 \| null` (consumido pelo `<LeadSiteEditModal>` — shape v2 nested desde #197 PR-C). |

## Dependências

- `@tanstack/react-table` para a estrutura de colunas/rows
- `@/components/ai/message-generator`
- `@/components/ui/{table,sheet,button,badge,separator,card,tooltip}` (shadcn)
- `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`)
- `@/lib/validators/leads` (constantes e tipos)
- `@/lib/leads/list-leads` (tipos `LeadListItem`)
- `@/lib/supabase/server` (`createServerSupabase` para `<LeadSiteCard />`)
- `@/lib/env-public` (`NEXT_PUBLIC_APP_URL` para compor `/sites/<slug>`)
- `@/app/actions/lead-site` (`generateLeadSite` de #159, `updateLeadSiteVariables` de #168, `archiveLeadSite`/`restoreLeadSite` de #169, `sendLeadSiteWhatsApp` de #171, `regenerateVisualIdentity` de #216/#217)
- `@/lib/finance` — `formatBRL` para mostrar custo BRL no toast de regenerate identidade (#217)
- `@hookform/resolvers/zod` + `react-hook-form` (#168 modal)

## Quando atualizar este `CLAUDE.md`

- Nova coluna virada sortable → atualizar a lista de colunas + `LEAD_SORTABLE_COLUMNS`.
- Drawer evoluir para versão final em #20.
- Bulk actions / filtros desembarcarem (issues #19, #28).
- Novas tabs canônicas em `<LeadTabs />` → atualizar item 6 + entrada do
  arquivo na tabela.
