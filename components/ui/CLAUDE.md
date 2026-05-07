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

Todos os primitives mínimos do MVP estão instalados (issue #12 fechada). Lista completa:

| Path | Propósito |
|---|---|
| `alert.tsx` | Alert para mensagens inline (sucesso/erro/warning) |
| `avatar.tsx` | Avatar com fallback de inicials |
| `badge.tsx` | Pílulas/labels (estágio, contadores, tags) |
| `button.tsx` | Botão com variantes e sizes |
| `card.tsx` | Container com header/content/footer |
| `checkbox.tsx` | Checkbox para forms e bulk selection |
| `command.tsx` | Combobox/cmdk para multi-select e busca |
| `dialog.tsx` | Modal centralizado |
| `drawer.tsx` | Drawer mobile-first (Vaul) |
| `dropdown-menu.tsx` | Menu dropdown contextual |
| `form.tsx` | **Custom** — wrapper RHF (shadcn 4.7+ entrega vazio do registry) |
| `input.tsx` | Input de texto |
| `input-group.tsx` | Agrupamento de input com addon (left/right icon) |
| `label.tsx` | Label com `htmlFor` |
| `scroll-area.tsx` | Scrollbar custom (sidebar, listas longas) |
| `select.tsx` | Select dropdown nativo-style |
| `separator.tsx` | Linha horizontal/vertical |
| `sheet.tsx` | Drawer lateral (Sidebar mobile, LeadDetailDrawer) |
| `skeleton.tsx` | Placeholder de loading |
| `sonner.tsx` | Toaster (wrap de Sonner com tema) |
| `switch.tsx` | Toggle on/off |
| `table.tsx` | Estrutura de tabela (TanStack consome) |
| `tabs.tsx` | Tabs (Login form, Lead drawer) |
| `textarea.tsx` | Multiline input (notas, prompt IA) |
| `tooltip.tsx` | Tooltip on-hover |

## Dependências

- `@radix-ui/*` (via `radix-ui` umbrella)
- `class-variance-authority`
- `lucide-react`
