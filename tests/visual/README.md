# Baselines visuais (issue #204)

## Onde ficam os PNGs

`tests/visual/figma-baseline/v3/` — 12 arquivos (6 rotas × 2 viewports):

- `home-desktop.png`, `home-mobile.png`
- `estoque-desktop.png`, `estoque-mobile.png`
- `detail-desktop.png`, `detail-mobile.png`
- `sobre-desktop.png`, `sobre-mobile.png`
- `contato-desktop.png`, `contato-mobile.png`
- `anunciar-desktop.png`, `anunciar-mobile.png`

## Como gerar ou atualizar

1. Configure `TEST_SEED_TOKEN`, `TEST_SEED_USER_ID` e Supabase real (mesmo fluxo dos E2E em `tests/e2e/sites/helpers.ts`).
2. Rode (a **primeira** vez pode ser sem PNGs — o flag `--update-snapshots` desativa o skip de baseline ausente):

```bash
npx playwright test --project=visual-sites --update-snapshots
```

3. Revise os PNGs e faça commit.

Sem seed ou sem `--update-snapshots` quando ainda não há `home-desktop.png`, o spec **pula** (CI permanece verde).

## Spec

Playwright: projeto `visual-sites` em `playwright.config.ts`, `snapshotPathTemplate` aponta para esta pasta.
