# Multi-Agent Review — gasp-search Phase 5 + Hotfix

**Data:** 2026-05-08
**Escopo:** Phase 5 (PRs #103–#116) + hotfix (#119, #121)
**Issue:** #128

Quatro agentes rodaram em paralelo, cada um com escopo isolado e read-only.

| Agente | Foco | Itens reportados |
|---|---|---|
| Bug-finding | Logic errors, races, fail-silent paths em código de Phase 5 | 5 (1 crítico, 3 altos, 1 médio) + 6 menores |
| Security | RLS bypass, secrets, OWASP, webhook auth | 5 (2 altos, 3 médios) + 7 verificados-limpos |
| UX consistency | Sidebar, navegação cruzada, empty states, dark mode | 5 actionable |
| Code health | Duplicação, dead code, test gaps, type escape hatches | 5 + 2 menores |

---

## Achados consolidados (deduplicados, ordenados por severidade)

### 🔴 CRITICAL

**[A] `app/api/campaigns/route.ts:77-86` — leadIds não-deduplicados quebram contrato de autorização.**
A validação `validLeads.length !== parsed.data.leadIds.length` falha quando o array de entrada tem duplicatas: `[lead1, lead1]` retorna 1 row do Supabase mas tem `length=2`, rejeitando legítimos. Combinado com a falta de filtro `user_id` no INSERT em `campaign_targets`, é frágil. **Fix:** dedup com `Set` antes da validação.

### 🟠 HIGH

**[B] `app/api/whatsapp/webhook/route.ts` — webhook auth bypass via instance slug previsível.**
- `evo_instance = user_${userId.slice(0,8)}` (8 chars hex = 32 bits) é fácil de enumerar.
- Fallback de auth aceita qualquer payload com slug existente — atacante pode injetar `messages.upsert` no inbox de outro usuário.
- `message.status` (linha ~99-105) atualiza `lead_messages` sem `user_id` filter via service-role; bypass total.
- Eventos `unknown` short-circuitam com 200 antes da validação, vazando informação de "se HMAC está configurado".

**Fix combinado:** (a) usar UUID/nanoid em `evo_instance` (não derivar do user_id); (b) sempre resolver `userId` via lookup antes de qualquer write; (c) filtrar `user_id` em todos os updates do webhook.

**[C] `lib/campaigns/processor.ts:179` — ternário dead-code.**
`status: failed === 0 ? "completed" : "completed"` — ambos os ramos iguais. Campanha 100% falha aparece como `completed`. Provável resíduo do hotfix anterior. **Fix:** decidir um terminal real (`partial` / `completed_with_errors`) ou simplificar para `"completed"`.

**[D] `app/api/ai/generate-message/route.ts:42-50` — rate-limit map cresce sem bound.**
`Map<userId, lastTs>` nunca é limpo. Em runtime serverless de longa duração, vaza memória; em multi-instance, é bypassável (cada cold-start zera). **Fix:** TTL/LRU local + Postgres-backed counter para limite real.

### 🟡 MEDIUM

**[E] `lib/messages/list-conversations.ts:80-94` — threads de leads removidos somem silenciosamente.**
`.filter(x => x !== null)` esconde mensagens de leads deletados. Webhook também dropa inbound de números desconhecidos sem log. **Fix:** placeholder "Lead removido" ou cascade delete em FK + log estruturado.

**[F] `lib/apify/enrich.ts:79` — sem validação de URL no enrich.**
`leads.website` aceita qualquer string ≤200 chars. Apify (servidor remoto) é o que executa o request, então SSRF interno é baixo, mas abuso da conta é possível. **Fix:** Zod refine `https?://` + bloqueio de hosts privados em `lib/validators/leads.ts`.

**[G] `app/api/campaigns/route.ts` — sem rate-limit.**
Usuário pode disparar campanhas back-to-back, exaurindo Anthropic e WhatsApp. **Fix:** 1 campanha ativa por user + bucket de N/hora.

**[H] STAGE_LABEL duplicado em 5 arquivos + `/leads/[id]` mostra enum cru.**
Mesmo `Record<LeadStage, string>` em `pipeline/board.tsx:41`, `leads-table.tsx:57`, `lead-detail-drawer.tsx:55`, `dashboard-view.tsx:29`, `filters-bar.tsx:34`. `app/(app)/leads/[id]/page.tsx:69` usa `<Badge>{lead.stage}</Badge>` sem mapeamento — mostra `in_conversation` cru. **Fix:** extrair `lib/leads/stage-presentation.ts`.

**[I] `app/(app)/leads/[id]/page.tsx` vs `lead-detail-drawer.tsx` — duas UIs divergentes pro mesmo lead.**
Rota tem tabs (Gerar / Histórico). Drawer tem tabs (Visão geral / Notas / Mensagens IA / Conversa). Edits acontecem só pelo drawer. UX inconsistente. **Fix:** convergir as duas para o mesmo `<LeadTabs />` reutilizável.

**[J] Cross-links faltando em `/messages/[leadId]`, `TargetStatusTable`, `Pipeline cards`.**
- Header de `/messages/[leadId]` é só `<h1>{lead.name}</h1>` — sem link para `/leads/[id]`, sem stage.
- `TargetStatusTable.tsx:88` mostra nome do lead em texto puro — não navega para lead/messages.
- Cards do kanban (`pipeline/board.tsx:~258`) draggable mas não clicáveis.

**Fix:** todos os cell-renders de `lead.name` devem ser `<Link href="/leads/${id}">`. Adicionar ícone secundário "abrir conversa" quando WhatsApp habilitado.

### 🟢 LOW (rollup)

- `lib/evolution/send.ts:46` e `webhook.ts:63` — `normalizePhone` duplicado com critérios diferentes (8-digit min vs 8-15).
- `components/whatsapp/instance-card.tsx:269` — `bg-white` literal (ok pro QR mas a UI ao redor não está em `bg-card`).
- `components/messages/conversation-thread.tsx:33` — `text-blue-500` sem `dark:` variant.
- `lib/campaigns/processor.ts:29` + `lib/evolution/rate-limit.ts:16` — magic `3_000` ms duplicado.
- `lib/evolution/templates.ts:81` — `extractPlaceholders` exportado mas usado só internamente.
- `app/(auth)/callback/route.ts:21` — open redirect potencial via `redirectTo=//evil.com`.
- `lib/evolution/send.ts:120-128` — branch `lead.stage === "contacted"` é dead.
- 12 ocorrências de `as unknown as` em `lib/leads/*`, `lib/ai/messages.ts`, `lib/dashboard/summary.ts`, `lib/apify/enrich.ts`, `app/api/ai/generate-message/route.ts:103`. **Fix:** regenerar `types/database.ts` via `supabase gen types typescript`.
- `app/api/campaigns/route.ts:55-148` — `processCampaign` inline; já planejado em #122 (BullMQ).
- `app/api/whatsapp/webhook/route.ts:130-142` — detect duplicate via string match (`"duplicate"`); usar `code === "23505"`.
- `lib/campaigns/processor.ts:55-67` — não verifica ownership da campanha antes de flippar para running (RLS protege, mas defesa em profundidade).

---

## Verificados-limpos

- **Secrets em client bundle:** `lib/env.ts` é `server-only`; nenhum `'use client'` importa `@/lib/env`. `lib/env-public.ts` só expõe `NEXT_PUBLIC_*`.
- **`createServiceSupabase`:** único uso é em `app/api/whatsapp/webhook/route.ts` (allowlist documentada em `lib/supabase/CLAUDE.md`).
- **HMAC verify:** `timingSafeEqual` com length precheck — constant-time, correto.
- **Mass assignment em `PATCH /api/leads/[id]`:** `updateLeadSchema` é `.strict()` e omite `user_id`/`id`/`created_at`/`enriched_at`.
- **TOCTOU webhook:** `request.text()` lido uma vez, `JSON.parse` na string preservada.
- **Empty states:** `/leads`, `/pipeline`, `/dashboard`, `/messages`, `/campaigns` têm cards/icons desenhados.
- **Sidebar:** todos os `NAV_ITEMS` routam corretamente; itens de WhatsApp gateados por `publicEnv`.

---

## Sub-issues abertas

(Capadas a 5 por área — restantes ficam no rollup low-severity acima.)

| Issue | Severidade | Tema |
|---|---|---|
| #129 | CRITICAL | dedupe `leadIds` em `POST /api/campaigns` |
| #130 | HIGH | webhook hardening (slug não-previsível + filtros user_id) |
| #131 | HIGH | corrigir terminal status no `processor.ts:179` |
| #132 | HIGH | rate-limit unbounded em `/api/ai/generate-message` |
| #133 | MEDIUM | listConversations: tratar leads removidos |
| #134 | MEDIUM | rate-limit em `POST /api/campaigns` |
| #135 | MEDIUM | extrair `STAGE_LABEL`/`STAGE_VARIANT` + corrigir `/leads/[id]` |
| #136 | MEDIUM | convergir `/leads/[id]` e `lead-detail-drawer` na mesma UI |
| #137 | MEDIUM | cross-links: messages → lead, target-status-table → lead/messages, pipeline cards |
| #138 | LOW | rollup tech-debt (normalizePhone, dark-mode, magic numbers, `as unknown as`) |

(Os números efetivos podem variar; este relatório foi gerado antes da abertura.)

---

## Próxima onda

Wave 3 do plano Phase 6 endereça parte destes achados via cobertura de teste (e2e + unit). As correções aplicadas das sub-issues acima entram em waves seguintes do milestone, em paralelo aos issues estratégicas já abertas (#122 BullMQ, #123 Real-time UX, #124 Dashboard insights).
