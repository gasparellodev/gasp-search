# `components/ui/` — Spec Técnica

## Propósito

Primitives do shadcn/ui — componentes de UI base (button, input, dialog, etc.) gerados pelo CLI shadcn a partir de Radix.

## Como adicionar

```bash
npx shadcn@latest add <componente>
```

Componentes são adicionados como arquivos editáveis no projeto (não como dependências de pacote). Você pode customizar livremente, mas para atualizar versão, prefira regenerar via CLI.

## Regras de negócio

1. **Não editar componentes shadcn manualmente** sem documentar a customização aqui. O CLI sobrescreve. Customizações devem ficar em arquivos separados (composições) em pastas-pai.
2. **Variantes adicionais** vão para um arquivo wrapper na pasta da área (`components/leads/lead-button.tsx`), não no `components/ui/button.tsx`.
3. **Removidos**: nunca delete um componente sem grep antes para garantir que não está em uso.

## Arquivos

| Path | Propósito |
|---|---|
| `button.tsx` | Botão base com variantes (default, destructive, outline, secondary, ghost, link) e sizes (default, sm, lg, icon) |

> Mais primitives em #12 (input, label, card, badge, select, dropdown-menu, dialog, drawer, sheet, tabs, table, form, textarea, checkbox, switch, tooltip, skeleton, sonner, command, avatar, separator, scroll-area).

## Dependências

- `@radix-ui/*` (via `radix-ui` umbrella)
- `class-variance-authority`
- `lucide-react`
