<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Notable Next 16 specifics in this repo:
- Auth gate lives in `proxy.ts` (root), not `middleware.ts`. Exports `proxy()`, not `middleware()`.
- `useSearchParams()` requires a `Suspense` boundary — see `app/(auth)/login/page.tsx` for the pattern.
- `useEffect(() => setX(...), [])` triggers `react-hooks/set-state-in-effect` lint error. Use `useSyncExternalStore` for SSR-safe mounted checks (see `components/layout/theme-toggle.tsx`).
- Tailwind v4 is CSS-first (`@theme inline { ... }` in `app/globals.css`); there's no `tailwind.config.ts`. Dark mode via `@custom-variant dark (&:is(.dark *))` + `.dark` class.
<!-- END:nextjs-agent-rules -->

# Project handoff

If you're picking up development on this project, **start here**:

1. Read [`HANDOFF.md`](./HANDOFF.md) — current state, what's done vs pending, and the recommended order of work.
2. Read [`CLAUDE.md`](./CLAUDE.md) — project-wide conventions, stack, and non-negotiable quality gates.
3. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) — the 12-step PR workflow that every change follows.
4. Each folder with files has its own `CLAUDE.md` documenting local rules — read it before editing in that folder.

# Quality gates per PR (non-negotiable)

- TDD: failing test before implementation.
- `npm run lint` zero warnings.
- `npx tsc --noEmit` zero errors.
- `npm test` green; coverage ≥ 80% lines/functions/statements, ≥ 75% branches in scope (`lib/`, `app/api/`, composed components).
- `npm run test:e2e` green for affected flows.
- CI green on the PR (5 status checks: lint, typecheck, unit, e2e, build).
- Code review + security review documented as PR comments.
- `CLAUDE.md` updated for any folder receiving new/modified files.
- Squash merge with `Closes #N` to auto-close the issue.
