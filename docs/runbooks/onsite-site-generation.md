# Runbook — Geração de site onsite

> Operação de visita presencial: gerar e publicar o site do cliente ao vivo,
> com QR code escaneado no celular dele pra demo. Da chegada à assinatura,
> meta < 8 min.

---

## 1. Pré-visita (fazer ANTES de sair pra rua)

**Lead pronta no admin.** Abrir `/leads/[id]` e confirmar:

- [ ] `name` (razão social ou nome do dono) preenchido.
- [ ] `phone` em formato BR (`(81) 99999-9999` ou `+5581…`) — sem isso,
      o modal pré-gen **bloqueia** a geração.
- [ ] `business_name` (se diferente de `name`).
- [ ] `website` e `instagram_handle` (opcionais, mas melhoram a copy).
- [ ] `location_city` + `location_state` (opcionais, melhoram SEO local).

**Sessão logada com 2FA pronto.** Se cair sessão durante a visita, o 2FA
precisa ser rápido. Confirmar que o app autenticador está no celular **do
operador** (não no do cliente).

**Conexão.** Levar iPad + roteador 4G dedicado. Wi-Fi do cliente é hostil
(captive portal, throttling). Geração faz uma chamada Anthropic
(~30-60s) — qualquer corte mata.

**Pré-checagem de saúde (~5min antes).** Em uma lead de teste:

1. Abrir modal "Verificar dados antes de gerar".
2. Cancelar. Confirmar que botões respondem.
3. Validar que `GET /api/leads/[id]/sites` retorna 200.

Se algo travar aqui, **não inicie a visita** — abra incidente.

---

## 2. Durante o pitch (~10 min)

### Roteiro

| Tempo | Ação |
|---|---|
| 0-2min | Apresentação + showcase de site pronto de outro cliente |
| 2-4min | Operador abre `/leads/[id]` na frente do cliente |
| 4-5min | Modal "Verificar dados" — operador lê em voz alta, cliente confirma cada campo |
| 5-6min | Operador edita slug pra algo memorável (`gasplab.com.br/sites/<nome-do-negocio>`). Confirma. |
| 6-7min | Tela de progresso — operador comenta o que está acontecendo (3 estágios). |
| 7-8min | QR code aparece. Cliente escaneia. Site abre no celular do cliente. |
| 8-10min | Operador caminha pelas seções (home, estoque vazio, contato). Cliente reage. |

### Janelas de tolerância

- **Geração saudável:** termina em **30-60s**.
- **Lenta mas aceitável:** **60-90s** (atribuir a 4G ruim, manter pitch
  vivo com perguntas).
- **Travou:** **> 90s sem QR**. Cancelar mentalmente, executar
  [seção 3: Falha](#3-falha-durante-a-visita).

### Rate limit

- Limite: **5 gerações por minuto por usuário** (constante
  `RATE_LIMIT_MAX_PER_WINDOW`).
- Se o operador clicar repetidamente em "Tentar de novo", vai estourar
  rápido. Aguardar o `retryAfterSec` que aparece no toast.

---

## 3. Falha durante a visita

### Sintoma A — Modal de progresso travado, sem QR

1. **Não recarregar a página.** Aguardar até 90s totais.
2. Se passou 90s, **abrir DevTools** (operador faz isso fora da vista
   do cliente, ou na sala ao lado). Network tab → procurar request pendente.
3. Em paralelo, comentar com o cliente: "estamos gerando algumas variações
   pra você escolher a melhor."

### Sintoma B — Card mostra "Geração falhou" (badge vermelho draft-error)

O fluxo Sprint A4 deixa o estado visível. Operador vê **motivo** extraído
de `generation_error` JSON.

Decisão por código de erro:

| `error` retornado | Significado | Ação |
|---|---|---|
| `auth` | Sessão expirou | Re-login com 2FA, retry |
| `not_found` | Lead foi deletada/RLS | Abortar, abrir incidente |
| `rate_limit` | 5 gerações/min estouradas | Aguardar `retryAfterSec` no toast |
| `slug_invalid` | Slug com caracteres inválidos | Voltar ao modal, escolher outro |
| `slug_taken` | Slug já existe em outro site | Voltar ao modal, escolher outro |
| `ai_error` | Anthropic timeout/5xx | **Descartar rascunho** + Tentar de novo (1x) |
| `validation` | Schema Zod falhou no JSON gerado | **Descartar rascunho** + Tentar de novo (1x) |
| `db_error` | Falha ao persistir | Tentar de novo (1x); se repetir, abortar |

### Recovery — "Descartar rascunho"

Botão aparece quando `status='draft' AND generation_error != null`. Faz
**hard-delete** da row de `lead_sites`, libera o slug. **Não** herda
brand assets / copy do anterior (start limpo).

### Quando abortar

Se 2 retries seguidos falharem com `ai_error`:

1. Fechar laptop, mudar de assunto ("vamos focar em entender melhor o
   estoque seu, eu te mando o site amanhã pelo WhatsApp").
2. **Após a visita**: abrir incidente em `#sites-onsite` com:
   - `leadId` (da URL `/leads/<id>`)
   - hora aproximada da falha
   - código de erro mostrado no toast
   - Vercel deployment URL ativo

Operações tentam novamente do escritório com `generateLeadSite` direto
(skip do modal pré-gen via "Tentar de novo").

---

## 4. Pós-geração — assinar + entregar

### a. Validar QR

Cliente escaneou. Site abriu. Operador confirma com cliente:

- [ ] Nome do negócio correto no header
- [ ] Telefone correto no rodapé / contato
- [ ] Cidade correta (se preenchida)

Se algo está errado, **abrir o editor inline** (lápis no card) e ajustar
sem regerar — `LeadSiteEditModal` permite edição direta dos campos
estruturados, sem nova chamada à IA.

### b. Assinar contrato

Operador chama `signLeadSite(leadSiteId)` via botão "Marcar como
assinado" no card. Isso seta `signed_at` e, em consequência:

1. Site fica indexável (`isIndexable(site)` → `true`).
2. Sitemap global em `/sites/sitemap.xml` passa a incluir o site.
3. OG image, llms.txt, schema.org ficam disponíveis pra crawlers.
4. **IndexNow** é disparado pra Bing/Yandex se `INDEXNOW_KEY` estiver
   setada no env. Falha de IndexNow não-fatal — só vira
   `console.warn` (`signLeadSite.indexnow_failed`).

### c. Enviar via WhatsApp

Botão "Enviar via WhatsApp" no modal QR / cluster published reusa
`sendLeadSiteWhatsApp`. Texto vai pré-preenchido com a URL pública
assinada. Cliente recebe link no celular, salva nos favoritos.

### d. Recibo no email

(Se habilitado no V2). Por ora — enviar manualmente do CRM.

---

## 5. Observabilidade — Vercel Logs

Após a visita, o gerente abre Vercel logs e filtra por
`generateLeadSite.outcome` (Sprint D2). Cada chamada emite **1 evento**
no final com:

```json
{
  "action": "generateLeadSite",
  "step": "outcome",
  "leadId": "<uuid>",
  "userId": "<uuid>",
  "durationMs": 47312,
  "ok": true,
  "customSlug": true,
  "slug": "auto-recife"
}
```

Quando falha:

```json
{
  "action": "generateLeadSite",
  "step": "outcome",
  "leadId": "<uuid>",
  "userId": "<uuid>",
  "durationMs": 12450,
  "ok": false,
  "customSlug": false,
  "error": "ai_error"
}
```

### Queries úteis

- **Taxa de sucesso do dia**: filter `step:outcome ok:true` / total
  com `step:outcome`.
- **p95 de duração (saudáveis)**: aggregate `durationMs` filtrado
  por `ok:true`.
- **Distribuição de falhas**: group by `error` filtrado por `ok:false`.

### Eventos intermediários

Antes do `outcome`, cada chamada também emite `generateLeadSite.step`
em pontos-chave (`lead_lookup`, `slug`, `claude`, `validate`,
`persist`, `complete`) e `generateLeadSite.error` quando falha. Esses
permitem identificar **onde** travou — útil em debug, mas para SLO o
evento canônico é `outcome`.

### O que NÃO está no log (PII-safe)

- `lead.name`, `email`, telefone — não vazam pra logs.
- Copy gerada pela IA — não logada.
- O valor do `customSlug` (operador pode usar PII como slug) — só
  o booleano `customSlug:true|false` é registrado. O `slug` final
  só sai quando `ok:true` (já passou validação anti-blacklist).

---

## 6. Métricas-meta (revisar mensalmente)

| Métrica | Meta | Como medir |
|---|---|---|
| Taxa de sucesso geração | ≥ 95% | Vercel logs, filtro `outcome` |
| p95 de duração (ok:true) | ≤ 75s | Vercel logs, aggregate `durationMs` |
| Tempo médio login → assinatura | ≤ 8 min | Cronometrar manualmente nas visitas |
| Taxa de retry após `ai_error` | ≤ 5% das gerações | Logs + sentry |
| Sites assinados / visitas | ≥ 70% | Funil no CRM |

---

## 7. Mudanças neste runbook

Atualizar este arquivo quando:

- Códigos de erro de `generateLeadSite` mudarem (ver tipo
  `GenerateLeadSiteResult` em `app/actions/lead-site.ts`).
- `RATE_LIMIT_MAX_PER_WINDOW` ou `RATE_LIMIT_WINDOW_MS` mudarem.
- Novos campos de telemetria forem adicionados a `logOutcome`.
- Fluxo de assinatura (`signLeadSite`) mudar.

Manter consistente com o plano mestre em
`~/.claude/plans/precisamos-de-uma-analise-purring-fern.md` (local,
não commitado).
