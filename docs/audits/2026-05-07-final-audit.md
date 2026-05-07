# Auditoria final — 2026-05-07

## Coverage

Comando:

```bash
npm test -- --coverage
```

Resultado:

- Test files: 55 passed
- Tests: 322 passed
- Statements: 91.09%
- Branches: 77.94%
- Functions: 93.65%
- Lines: 93.56%

## Lighthouse

Comando:

```bash
npx lighthouse http://localhost:3001/login \
  --only-categories=performance,accessibility \
  --chrome-flags='--headless --no-sandbox' \
  --output=json \
  --output-path=/tmp/gasp-search-lighthouse-login.json
```

Resultado em `/login`:

- Performance: 86
- Accessibility: 100

Observação: as rotas autenticadas exigem sessão real para auditar sem
redirecionamento. Os testes E2E autenticados seguem pulando quando
`E2E_AUTH_EMAIL` e `E2E_AUTH_PASSWORD` não estão configurados.
