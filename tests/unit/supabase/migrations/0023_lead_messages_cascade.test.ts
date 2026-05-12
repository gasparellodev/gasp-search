import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0023_lead_messages_cascade.sql"),
  "utf8",
);

describe("migration 0023 — lead_messages_lead_id ON DELETE CASCADE", () => {
  it("dropa o FK anterior idempotente antes de recriar", () => {
    // Defesa contra drift: ambientes onde 0001 nunca foi aplicado com a
    // semântica original (ex.: rebuilds parciais) podem ter o FK sem cascade.
    // Forçamos a reconciliação dropando antes de recriar.
    expect(sql).toMatch(
      /alter table public\.lead_messages\s+drop constraint if exists lead_messages_lead_id_fkey/i,
    );
  });

  it("recria o FK lead_messages.lead_id apontando para leads(id) com ON DELETE CASCADE", () => {
    // Contrato pós-#133: deletar um lead remove suas mensagens automaticamente.
    // Sem cascade, o handler de inbox (`lib/messages/list-conversations.ts`)
    // precisava esconder mensagens órfãs com `.filter(x => x !== null)`,
    // perdendo histórico silenciosamente.
    expect(sql).toMatch(
      /alter table public\.lead_messages\s+add constraint lead_messages_lead_id_fkey\s+foreign key \(lead_id\)\s+references public\.leads\(id\)\s+on delete cascade/i,
    );
  });
});
