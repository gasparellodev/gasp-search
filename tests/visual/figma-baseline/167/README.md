# Visual baseline — Issue #167 LeadSiteCard

## Status: NO FIGMA REFERENCE AVAILABLE

A query MCP `mcp__figma__get_figma_data` no `fileKey: g2rNyep5Y66GczfX2Ad6hO`
(canvas App + Componentes) com depth 2 retornou somente os frames do **site
público** (Touring Cars / Home / Stock / About / Contact / Announce — issue
#162 e correlatos).

Não há frame "LeadSiteCard", "Site card" ou similar no Figma — esse card
faz parte da UI interna do CRM (rota `/leads/[id]`), que ainda não foi
mockada no Figma do produto.

## Decisão

QA visual fica **bloqueado** por ausência de referência. As alternativas:

1. **PO/Designer cria mock no Figma** → screenshot baseline aqui via
   `mcp__figma__download_figma_images`.
2. **QA aprova snapshot do Playwright sem comparação** (referência
   "self-baseline" — primeira execução vira o baseline; regressões
   futuras pegam pixel-diff contra esse snapshot).

Recomendação: **opção 2** pra desbloquear o PR. Quando designer fizer
o frame, sobrescrever os PNGs aqui e ativar comparação real.

## Referência da implementação

- `components/leads/lead-site-card.tsx` (Server Component, 4 estados)
- `components/leads/lead-site-card-actions.tsx` (Client cluster)
- AC9 da issue #167: tolerância pixel-diff ≤ 5% em desktop (1906px)
  e mobile (375px) na rota `/leads/[id]`.
