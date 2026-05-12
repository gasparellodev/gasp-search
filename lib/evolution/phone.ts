// Sem `server-only`: helper puro, sem secrets. Reusado por:
//   - `lib/evolution/send.ts` (envio outbound 1-a-1 e por campanha)
//   - `lib/evolution/webhook.ts` (parser de eventos inbound do Evolution)
//
// ----------------------------------------------------------------------------
// `normalizePhone` — fonte única de normalização de telefone para o Evolution.
// ----------------------------------------------------------------------------
//
// Critério **8–15 dígitos** (E.164 sem `+`):
//   - 8 dígitos cobre fixo brasileiro local sem DDD (`3333-4444`).
//   - 15 dígitos é o teto absoluto do E.164 (DDI até 3 + subscriber).
//   - Brasileiros com/sem 9 e com/sem código país (`+55`) ficam dentro do
//     range (10/11/12/13 dígitos).
//
// Antes do split (#138a), `send.ts` exigia ≥ 8 e `webhook.ts` exigia 8–15.
// O critério canônico fica com o range fechado: o critério permissivo da
// `send.ts` aceitava 16+ dígitos absurdos que o WhatsApp recusaria; alinhar
// nos dois lados evita aceitar phones que falham na primeira chamada do
// Evolution.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}
