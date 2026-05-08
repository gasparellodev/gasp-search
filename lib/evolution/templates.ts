import "server-only";
import type { LeadForMessage } from "@/lib/ai/anthropic";

// ----------------------------------------------------------------------------
// Renderização de templates de mensagem para campanhas modo `template`.
// ----------------------------------------------------------------------------
// Sintaxe: `{{nome}}`, `{{cidade}}`, etc. Apenas placeholders da lista
// `SUPPORTED_PLACEHOLDERS` são substituídos. Placeholders desconhecidos ficam
// no texto literal — `validateTemplate` aponta isso para o usuário no preview.
// ----------------------------------------------------------------------------

export const SUPPORTED_PLACEHOLDERS = [
  "nome",
  "cidade",
  "estado",
  "categoria",
  "rating",
  "website",
  "telefone",
] as const;

export type SupportedPlaceholder = (typeof SUPPORTED_PLACEHOLDERS)[number];

const SUPPORTED_SET = new Set<string>(SUPPORTED_PLACEHOLDERS);

// `\s*` permite `{{ nome }}` com espaços; `[a-zA-Z0-9_]+` casa só identificadores.
// Sem aninhamento — mantém o regex simples e previsível.
const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function leadValue(
  lead: LeadForMessage,
  placeholder: SupportedPlaceholder,
): string {
  switch (placeholder) {
    case "nome":
      return lead.name;
    case "cidade":
      return lead.city ?? "";
    case "estado":
      return lead.state ?? "";
    case "categoria":
      return lead.category ?? "";
    case "rating":
      return lead.rating != null ? String(lead.rating) : "";
    case "website":
      return lead.website ?? "";
    case "telefone":
      // Preferimos `whatsapp` quando existe (é o canal final). `phone` é fallback.
      return lead.whatsapp ?? lead.phone ?? "";
  }
}

/**
 * Substitui placeholders suportados pelo valor do lead. Placeholders ausentes
 * no lead (campos null) viram string vazia. Placeholders desconhecidos
 * permanecem no texto — use `validateTemplate` antes de chamar isto pra
 * avisar o usuário.
 */
export function renderTemplate(text: string, lead: LeadForMessage): string {
  return text.replace(PLACEHOLDER_REGEX, (match, raw: string) => {
    const key = raw.toLowerCase();
    if (SUPPORTED_SET.has(key)) {
      return leadValue(lead, key as SupportedPlaceholder);
    }
    return match;
  });
}

/**
 * Lista de placeholders presentes no texto, sem duplicatas e em ordem
 * lexicográfica. Inclui placeholders desconhecidos (use `validateTemplate`
 * para distinguir).
 */
export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_REGEX)) {
    if (match[1]) {
      found.add(match[1].toLowerCase());
    }
  }
  return [...found].sort();
}

/**
 * Detecta placeholders desconhecidos para feedback no UI.
 * `valid` é true quando todos os placeholders usados estão em
 * `SUPPORTED_PLACEHOLDERS`.
 */
export function validateTemplate(text: string): {
  valid: boolean;
  unknownPlaceholders: string[];
} {
  const used = extractPlaceholders(text);
  const unknown = used.filter((p) => !SUPPORTED_SET.has(p));
  return {
    valid: unknown.length === 0,
    unknownPlaceholders: unknown,
  };
}
