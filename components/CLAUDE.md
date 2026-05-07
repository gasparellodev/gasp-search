# `components/` — Spec Técnica

## Propósito

Componentes React do app, organizados por área. Inclui as primitives shadcn/ui e composições específicas do produto.

## Como adicionar

- **Componente shadcn**: `npx shadcn@latest add <componente>` → arquivo em `components/ui/<nome>.tsx`. Não editar manualmente; use o CLI para adicionar/atualizar.
- **Componente de layout** (sidebar, topbar): `components/layout/<nome>.tsx`.
- **Composição por área**: pasta com nome da área (`search/`, `leads/`, `pipeline/`, `ai/`). Cada área tem seu próprio `CLAUDE.md` quando os arquivos forem adicionados.
- **Sempre** Server Component por default. `'use client'` só quando precisar de estado/handlers/hooks de cliente.
- **Naming**: `kebab-case` para arquivo, `PascalCase` para export default.
- **Props**: tipadas explicitamente; nada de `any`. Use `Readonly<{ ... }>` quando o consumidor não vai mutar.
- **Sem lógica de negócio em componentes.** Lógica vai para `lib/` ou Server Actions.

## Regras de negócio

1. **Acessibilidade obrigatória.** Use Radix primitives (via shadcn) para qualquer interação. Lighthouse A11y ≥ 95.
2. **Componentes acima de ~200 linhas devem ser quebrados.** Uma responsabilidade por arquivo.
3. **Variantes via CVA** (`class-variance-authority`), padrão shadcn. Não duplique markup para variantes.
4. **`cn()` (de `lib/utils`) é o ÚNICO modo de combinar classes Tailwind condicionais.** Não concatene strings de classe manualmente.
5. **Animações via `tw-animate-css`** ou Radix. Sem JS animation libs adicionais (framer-motion só com justificativa).

## Arquivos

| Path | Propósito |
|---|---|
| `ui/button.tsx` | Botão shadcn com variantes (default, outline, ghost, etc.) |

> Mais componentes serão adicionados em #12 (shadcn components mínimos), depois nas issues por área.

## Dependências

- `radix-ui` (primitives via shadcn)
- `class-variance-authority` (variantes)
- `clsx` + `tailwind-merge` (via `lib/utils.cn`)
- `lucide-react` (ícones)
- `tw-animate-css` (animações)

## Quando atualizar este `CLAUDE.md`

- Nova subpasta de área criada.
- Novo padrão de composição estabelecido (e.g., container + provider).
- Mudança em CVA convention.
