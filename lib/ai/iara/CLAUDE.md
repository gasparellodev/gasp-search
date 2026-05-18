# `lib/ai/iara/` — Spec Técnica

## Propósito

Configuração do agente **Iara** — assistente virtual de pré-vendas que conversa com lojistas de seminovos via WhatsApp (Evolution API). Faz primeiro contato, tira dúvidas básicas, qualifica o lead e escala pro founder (handoff P0/P1/P2/P3).

Pattern: AI Agent (LLM + tools + memória + guardrails). Modelo: `claude-haiku-4-5` (driver) com fallback `claude-sonnet-4-6` em conversas >8 trocas.

## Como adicionar

- Toda mudança no **system prompt** exige nova simulação de cenários (mínimo 10) antes do deploy — não mexer direto em produção.
- Mudanças nos **LIMITES DUROS** ou **CRITÉRIOS DE HANDOFF** exigem revisão do CAIO Architect (`squads/c-level-squad/agents/caio-architect.md`).
- Cada bump na versão (`IARA_VERSION`) deve documentar o que mudou abaixo na seção "Histórico".
- Toda tool nova deve ter: schema Anthropic, instrução de USO no system prompt, implementação no handler (`app/api/iara/tools/`), teste unitário.

## Regras de negócio

1. **Identificação obrigatória.** A Iara SEMPRE se identifica como assistente virtual na Msg 1 (LGPD + Marco Civil + ética). Esconder = bloqueador de deploy.
2. **NUNCA acessar URL externa.** A Iara não tem tool de fetch HTTP. Se o cliente mandar link do site dele, escale P1 — NÃO analise.
3. **NUNCA confirmar pagamento.** Só o webhook Asaas pode confirmar. Iara só pode chamar `gerar_link_checkout` após `escalar_para_humano(P0)`.
4. **NUNCA negociar desconto.** Se cliente pedir, escale P1 imediato. Política de preço é única (R$ 700 + R$ 300/mês).
5. **NUNCA inventar fato sobre o founder.** Use apenas a `founder_descricao` configurada via `getIaraSystemPrompt({...})`. Se cliente quer mais info, escale P1.
6. **NUNCA inventar referência geográfica.** Quando perguntarem "vocês atendem aqui?", responder pelo ângulo de exclusividade ("você seria das primeiras lojas daí").
7. **Founder revisa 100% dos handoffs P0/P1** nos primeiros 60 dias. Sem isso, IA aprende padrões ruins.
8. **Bias audit mensal.** Revisar 50 conversas aleatórias por mês. Tom precisa ser consistente entre regiões/portes de loja.
9. **Kill switch.** Função `disableIara()` (a ser implementada em `app/api/iara/admin/`) para desligar em <30s caso aconteça algo grave. Owner: founder.

## Arquivos

| Path | Propósito |
|---|---|
| `system-prompt.ts` | System prompt v1.1 + schema das 6 tools. Função `getIaraSystemPrompt({ founder_name, founder_descricao })` retorna string final pra passar pra `anthropic.messages.create({ system, tools })`. |
| `memory.ts` | **Fase 1 backbone.** Server-only. `getOrCreateConversation`, `appendMessage`, `loadHistory`, `recordHandoff` operando em `whatsapp_conversations`, `iara_messages`, `iara_handoffs` (migration 0025). Usa service-role e propaga `user_id` explicitamente. |
| `tools/index.ts` | **Fase 1 backbone.** Server-only. `IARA_TOOL_HANDLERS` (record indexado por `IaraToolName`) + `isIaraToolName` (type guard). Implementação sandbox-friendly das 6 tools — link Asaas é fake, `estoque_count_estimate=0`. Ver `lib/ai/iara/tools/CLAUDE.md`. |

## Tools (resumo)

| Nome | Quando usar | Bloqueador? |
|---|---|---|
| `consultar_estado_lead` | Início de cada conversa, pra contextualizar | Não |
| `gerar_link_checkout` | APÓS P0, gera link Asaas | Sim — só após P0 |
| `escalar_para_humano` | P0/P1/P2/P3 conforme system prompt | Não |
| `agendar_followup` | Cliente disse "te chamo depois" / "vou pensar" — D+2 a D+4 aleatório | Não |
| `marcar_lead_morto` | Recusa explícita / opt-out / 30+ dias silêncio | Não |
| `marcar_demanda_nao_atendida` | Cliente pediu feature fora do escopo (logo, app, CRM) — vira roadmap input | Não |

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Ban Meta por padrão automático | Variação 5-8 templates Msg 1 + delays 8-25s entre mensagens + 2-3 chips rotativos. Infra cuida disso. |
| Alucinação sobre site externo | Limite duro #11 + seção dedicada no prompt. **Patch crítico do v1.1.** |
| Alucinação sobre founder | Seção `## SOBRE O ${founder}` com texto factual configurável. |
| Cliente detecta IA e queima reputação | Identificação clara desde Msg 1 + tom natural + fallback rápido pra humano. |
| Founder bottleneck reverso (muitos P0) | Limitar handoff P0 em 10-15/dia. Se exceder, IA marca P2 (fila dia seguinte). |

## Governance (Responsible AI Framework)

- **Owner:** founder (não pode terceirizar)
- **Risk tier:** MEDIUM (customer-facing + financial)
- **Audit log:** toda conversa logada em `whatsapp_conversations` com tool_calls, handoff decisions, motivos
- **Drift detection:** alerta se Iara usar vocabulário proibido ou desviar de tom em >5% das conversas semanais

## Histórico de versões

| Versão | Data | Mudanças |
|---|---|---|
| **1.1** | 2026-05-18 | 6 patches do v1.0 após simulação de 10 cenários: (1) limite duro NÃO acessar site externo, (2) seção SOBRE O FOUNDER factual, (3) geografia em ângulo de exclusividade, (4) tool `marcar_demanda_nao_atendida`, (5) resposta-tipo "garantia é truque" oficial, (6) follow-up randomizado D+2 a D+4. |
| 1.0 | 2026-05-18 | Versão inicial entregue pelo CAIO Architect. **Reprovada** pra produção devido a Issue Crítico #1 (alucinação ao analisar site externo do cliente). |

## Próximos passos (Fase 1: Echo Iara em sandbox)

- [x] `app/api/iara/sandbox/conversation/route.ts` — endpoint POST que recebe mensagem do lead, monta histórico, chama Anthropic com `getIaraSystemPrompt` + `IARA_TOOLS`, executa loop de tool_use (max 3 iterações), persiste turnos. **Renomeado de `/api/iara/conversation/` pra `/api/iara/sandbox/conversation/`** já que Fase 1 é só sandbox; Fase 2 abre `/api/iara/conversation/` apontando pro Evolution webhook.
- [x] `lib/ai/iara/tools/index.ts` — 6 handlers (consultar_estado_lead com fallback de placeholder, gerar_link_checkout stub Asaas sandbox, escalar_para_humano delegando a `recordHandoff`, agendar_followup persistindo em nova tabela, marcar_lead_morto preservando notes existentes, marcar_demanda_nao_atendida em tabela de sinais). Stub: implementação sandbox-friendly até Fase 2 integrar Asaas + estoque real.
- [x] `lib/ai/iara/memory.ts` — `getOrCreateConversation` (idempotente por (lead_id, user_id)), `appendMessage` (insert + bump `last_message_at`), `loadHistory` (ASC ordering), `recordHandoff`.
- [x] `supabase/migrations/0025_iara_sandbox.sql` — 5 tabelas: `whatsapp_conversations`, `iara_messages`, `iara_handoffs`, `iara_scheduled_followups`, `iara_demand_signals`. Todas com RLS + isolamento `user_id = auth.uid()` (direto ou transitivo via conversa).
- [x] Testes Vitest — `system-prompt.test.ts`, `memory.test.ts`, `tools.test.ts`, `conversation-route.test.ts`, `0025_iara_sandbox.test.ts` (migration SQL assertions).
- [x] `app/(app)/admin/iara/sandbox/page.tsx` — UI sandbox pra founder mandar mensagens e ver respostas + tool_calls + handoffs (Fase 1 UI). Server Component carrega leads + detalhe se `?leadId=...` vier na URL; renderiza `<IaraConversationsList>` + `<IaraSandboxClient>`.
- [x] `app/(app)/admin/iara/review/page.tsx` — dashboard de revisão. Filtros (approval, handoff, busca) sincronizam com URL. Ações inline aprovar/reprovar disparam PATCH `/api/iara/sandbox/conversation/[id]/review`.
- [x] Endpoints `GET /api/iara/sandbox/conversations` (lista paginada), `GET/DELETE /api/iara/sandbox/conversation/[id]` (detalhe + reset cascade), `PATCH /api/iara/sandbox/conversation/[id]/review` (aprovar/reprovar com notas).
- [x] Migration `0026_iara_approval.sql` adiciona `approval_status`/`approval_notes`/`reviewed_at`/`reviewed_by` em `whatsapp_conversations` + index `(user_id, approval_status, last_message_at desc)`.
- [ ] Fase 2: webhook Evolution real, delays 8-25s, Msg 1 variantes Hormozi, link Asaas real, feature flag, worker de follow-ups agendados, kill switch `disableIara()`.

Gate de avanço da Fase 1: founder aprova tom + handoffs em 30 conversas simuladas dentro do dashboard (depende da UI sandbox).
