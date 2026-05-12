import { describe, expect, it } from "vitest";

import {
  AnnouncementSchema,
  type AnnouncementInput,
} from "@/lib/sites/announce.schema";

describe("announce.schema re-export", () => {
  it("reexporta o mesmo schema de announcement.schema", () => {
    const input: AnnouncementInput = {
      marca: "VW",
      modelo: "Gol",
      ano: 2020,
      km: 10000,
      combustivel: "Flex",
      cambio: "Manual",
      cor: "Branco",
      motor: "1.0",
      nome: "João",
      telefone: "11999999999",
      email: "j@example.com",
      lgpd_consent: true,
    };
    expect(() => AnnouncementSchema.parse(input)).not.toThrow();
  });
});
