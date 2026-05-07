# `components/layout/` — Spec Técnica

## Propósito

Componentes do shell autenticado: Sidebar, Topbar, ThemeToggle, UserMenu.

## Como adicionar

- **Novo componente de shell**: arquivo dedicado. Distinguir Server vs Client por uso de hooks (`useTheme`, `usePathname`, etc.).
- **Wrap de Server props**: Topbar é Server, recebe dados via props e delega Client subcomponents (UserMenu, ThemeToggle).

## Regras de negócio

1. **Sidebar é Client** porque usa `usePathname` para marcar rota ativa.
2. **Topbar é Server** — recebe `email`, `name`, `avatarUrl` do layout; passa para UserMenu (Client).
3. **ThemeToggle é Client** com `useEffect` para evitar hydration mismatch (theme não é determinable no server).
4. **UserMenu é Client** porque chama `supabase.auth.signOut()` e `useRouter`.
5. **Hidden em mobile**: Sidebar `hidden md:flex`. Issue futura adiciona Sheet trigger no Topbar para mobile.
6. **Acessibilidade**: aria-labels em ícones-only buttons. `aria-current="page"` em link ativo. Sidebar com `role="navigation"` (implícito por `<nav>`).

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `sidebar.tsx` | Client | Navegação principal (5 items) com active state via `usePathname` |
| `topbar.tsx` | Server | Header com ThemeToggle + UserMenu |
| `theme-toggle.tsx` | Client | Botão Sun/Moon usando `useTheme` |
| `user-menu.tsx` | Client | Dropdown com avatar, info do user, logout |

## Dependências

- `next-themes` (`useTheme`)
- `@/lib/supabase/client` (logout)
- `@/components/ui/{avatar,button,dropdown-menu,scroll-area,separator}`
- `lucide-react`

## Quando atualizar este `CLAUDE.md`

- Novo item na navegação.
- Mudança no shell (e.g., adicionar Breadcrumbs no Topbar).
- Suporte a mobile com Sheet drawer.
