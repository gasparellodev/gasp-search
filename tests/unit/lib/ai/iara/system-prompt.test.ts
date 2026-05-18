import { describe, expect, it } from "vitest";
import {
  IARA_TOOLS,
  IARA_VERSION,
  getIaraSystemPrompt,
  type IaraToolName,
} from "@/lib/ai/iara/system-prompt";

describe("getIaraSystemPrompt", () => {
  it("interpola founder_name no topo e em referências chave", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain("aqui é a Iara — assistente virtual do Vinicius");
    expect(prompt).toContain("## SOBRE O VINICIUS");
    expect(prompt).toContain("passar pro Vinicius");
  });

  it("preserva o founder_name customizado (não cai no default)", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Joana" });
    expect(prompt).toContain("## SOBRE O JOANA");
    expect(prompt).not.toContain("## SOBRE O VINICIUS");
  });

  it("usa default factual de founder_descricao quando não passado", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain("É o responsável pelos sites no GaspLab.");
  });

  it("substitui founder_descricao quando passado", () => {
    const prompt = getIaraSystemPrompt({
      founder_name: "Vinicius",
      founder_descricao: "Trabalha com sites há 8 anos.",
    });
    expect(prompt).toContain("Trabalha com sites há 8 anos.");
    expect(prompt).not.toContain("É o responsável pelos sites no GaspLab.");
  });

  it("contém todos os 12 limites duros explicitamente numerados", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain("## LIMITES DUROS");
    for (let i = 1; i <= 12; i++) {
      expect(prompt).toMatch(new RegExp(`${i}\\. NUNCA`));
    }
  });

  it("contém seção crítica sobre site atual do cliente (patch v1.1 #1)", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain(
      "## QUANDO O CLIENTE MOSTRAR O SITE ATUAL DELE",
    );
    expect(prompt).toContain("NÃO acesse URL nenhuma externamente");
    expect(prompt).toContain('escalar_para_humano(lead_id, priority="P1"');
  });

  it("contém a seção GEOGRAFIA em ângulo de exclusividade", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain("## GEOGRAFIA");
    expect(prompt).toContain(
      "você seria uma das primeiras lojas daí",
    );
  });

  it("declara as 4 prioridades de handoff (P0-P3)", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toMatch(/### P0 — URGENTE/);
    expect(prompt).toMatch(/### P1 — ALTA/);
    expect(prompt).toMatch(/### P2 — NORMAL/);
    expect(prompt).toMatch(/### P3 — BAIXA/);
  });

  it("expõe a versão atual no preâmbulo", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "Vinicius" });
    expect(prompt).toContain(`(v${IARA_VERSION})`);
  });

  it("trim em founder_name protege contra espaços acidentais", () => {
    const prompt = getIaraSystemPrompt({ founder_name: "  Vinicius  " });
    expect(prompt).toContain("## SOBRE O VINICIUS");
    expect(prompt).not.toContain("## SOBRE O   VINICIUS");
  });
});

describe("IARA_VERSION", () => {
  it("é uma string semver-like", () => {
    expect(typeof IARA_VERSION).toBe("string");
    expect(IARA_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe("IARA_TOOLS schema", () => {
  it("expõe exatamente 6 tools com os nomes esperados", () => {
    expect(IARA_TOOLS).toHaveLength(6);
    const names = IARA_TOOLS.map((t) => t.name).sort();
    const expected: IaraToolName[] = [
      "agendar_followup",
      "consultar_estado_lead",
      "escalar_para_humano",
      "gerar_link_checkout",
      "marcar_demanda_nao_atendida",
      "marcar_lead_morto",
    ];
    expect(names).toEqual(expected.sort());
  });

  it("toda tool tem description não-vazia e input_schema do tipo object", () => {
    for (const tool of IARA_TOOLS) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.input_schema.type).toBe("object");
    }
  });

  it("escalar_para_humano exige priority em enum P0-P3", () => {
    const tool = IARA_TOOLS.find((t) => t.name === "escalar_para_humano");
    const properties = (tool?.input_schema.properties ?? {}) as Record<
      string,
      { enum?: readonly string[] }
    >;
    expect(properties.priority?.enum).toEqual(["P0", "P1", "P2", "P3"]);
  });

  it("agendar_followup limita dias_a_frente entre 2 e 7", () => {
    const tool = IARA_TOOLS.find((t) => t.name === "agendar_followup");
    const properties = (tool?.input_schema.properties ?? {}) as Record<
      string,
      { minimum?: number; maximum?: number }
    >;
    expect(properties.dias_a_frente?.minimum).toBe(2);
    expect(properties.dias_a_frente?.maximum).toBe(7);
  });
});
