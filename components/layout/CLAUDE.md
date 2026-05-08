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
5. **Mobile-first nav**: Sidebar desktop continua `hidden md:flex`; mobile usa `MobileNav` no Topbar com `Sheet` lateral e os mesmos `NAV_ITEMS`.
6. **Acessibilidade**: aria-labels em ícones-only buttons. `aria-current="page"` em link ativo. Sidebar com `role="navigation"` (implícito por `<nav>`).
7. **Sem overflow global**: shell usa `h-dvh`, `min-w-0` e `overflow-hidden`
   no wrapper principal; cada página/componente deve conter scroll localmente
   quando inevitável. Sidebar usa `h-full` para ocupar toda a lateral da
   viewport.
8. **Apple SK chrome (issue #145)**: Sidebar não tem borda lateral nem
   separador interno — Topbar desenha a única hairline horizontal do shell
   (`border-b border-border`). Topbar usa efeito vidro Apple
   (`bg-background/80 backdrop-blur-xl`).

## Arquivos

| Path | Tipo | Propósito |
|---|---|---|
| `sidebar.tsx` | Client | Navegação principal (5 items) com active state via `usePathname` |
| `topbar.tsx` | Server | Header com MobileNav, ThemeToggle + UserMenu |
| `theme-toggle.tsx` | Client | Botão Sun/Moon usando `useTheme` |
| `user-menu.tsx` | Client | Dropdown com avatar, info do user, logout |

## Dependências

- `next-themes` (`useTheme`)
- `@/lib/supabase/client` (logout)
- `@/components/ui/{avatar,button,dropdown-menu,scroll-area,separator}`
- `@/components/ui/sheet`
- `lucide-react`

## Quando atualizar este `CLAUDE.md`

- Novo item na navegação.
- Mudança no shell (e.g., adicionar Breadcrumbs no Topbar).
- Suporte a mobile com Sheet drawer.
