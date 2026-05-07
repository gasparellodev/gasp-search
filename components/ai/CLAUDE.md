# `components/ai/` — Spec Técnica

## Propósito

Componentes de UI para geração e uso de mensagens comerciais por IA.

## Como adicionar

- Componentes interativos devem ser Client Components com `'use client'`.
- Chame APIs internas (`/api/ai/*`) via `fetch`; nunca importe clients Anthropic em componentes.
- Mutations devem exibir `toast.success`/`toast.error` via `sonner`.
- Inputs de canal/tom devem reutilizar opções de `@/lib/validators/ai`.

## Regras de negócio

1. **Resultado editável.** Mensagens geradas devem poder ser revisadas antes de copiar/enviar.
2. **Clipboard explícito.** Copiar usa Clipboard API e confirma via toast.
3. **Sem persistência local como fonte da verdade.** A API persiste em `lead_messages`; histórico virá do banco.

## Arquivos

| Path | Propósito |
|---|---|
| `message-generator.tsx` | Form de canal/tom/objetivo, geração via API e resultado editável com copiar |

## Dependências

- `@/components/ui/*`
- `@/lib/validators/ai`
- `lucide-react`
- `sonner`
