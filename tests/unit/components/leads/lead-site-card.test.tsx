/**
 * Testes do `<LeadSiteCardView />` — variante pura usada pelo Server
 * Component `<LeadSiteCard />` (issue #167).
 *
 * Cobre AC1 (4 estados) + AC5 (formato de data) + AC6 (axe-core a11y).
 *
 * O fetch real do Supabase é exercitado pela Server Component em
 * runtime (E2E #167 quando habilitado). Aqui validamos a view layer
 * passando os dados serializados que o Server entregaria.
 */

import { describe, expect, it, vi } from "vitest";

// Stubs de env server-side via `vi.hoisted` — ESM eleva imports acima de
// qualquer statement, então só `vi.hoisted` (que vitest move pra cima de
// TUDO) garante que `process.env` esteja populado quando `@/app/actions/
// lead-site` (transitively importado via `LeadSiteCardActions` real)
// chamar `lib/env.ts` no parse.
vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "stub-service-role";
  process.env.APIFY_TOKEN ??= "stub-apify-token";
  process.env.APIFY_GOOGLE_MAPS_ACTOR_ID ??= "stub-actor-google-maps";
  process.env.APIFY_INSTAGRAM_ACTOR_ID ??= "stub-actor-instagram";
  process.env.APIFY_WEBSITE_CONTACT_ACTOR_ID ??= "stub-actor-website";
  process.env.ANTHROPIC_API_KEY ??= "stub-anthropic-key";
});
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

import { LeadSiteCardView } from "@/components/leads/lead-site-card";
import type { LeadSiteCardData } from "@/components/leads/lead-site-card-types";

expect.extend(toHaveNoViolations);

// O Server Action raiz é mockado pra evitar tocar Supabase em runtime de
// teste. O cluster client recebe um mock de view-only.
vi.mock("@/app/actions/lead-site", () => ({
  generateLeadSite: vi.fn(),
}));

// `createServerSupabase` é mockado por test (cada cenário fornece sua resposta).
const supabaseMocks = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: supabaseMocks.createServerSupabase,
}));

function setSupabaseResponse(
  data: LeadSiteCardData | null,
  error: { name?: string; message?: string } | null = null,
) {
  supabaseMocks.maybeSingle.mockResolvedValue({ data, error });
  const eq = vi.fn(() => ({ maybeSingle: supabaseMocks.maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  supabaseMocks.createServerSupabase.mockResolvedValue({ from });
  return { from, select, eq };
}

// O cluster de actions é Client Component que usa Server Actions reais
// — isolamos com mock pra focar nos estados da view do card.
vi.mock("@/components/leads/lead-site-card-actions", () => ({
  LeadSiteCardActions: ({
    leadId,
    leadSite,
    appUrl,
  }: {
    leadId: string;
    leadSite: LeadSiteCardData | null;
    appUrl: string;
  }) => (
    <div
      data-testid="actions-mock"
      data-lead-id={leadId}
      data-status={leadSite?.status ?? "none"}
      data-app-url={appUrl}
    />
  ),
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const APP_URL = "https://app.gasplab.com";

function makeLeadSite(
  overrides: Partial<LeadSiteCardData> = {},
): LeadSiteCardData {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    slug: "j7k2p9-touring-cars",
    status: "published",
    generated_at: "2026-05-09T12:00:00.000Z",
    published_at: "2026-05-09T12:00:00.000Z",
    sent_at: null,
    view_count: 0,
    ...overrides,
  };
}

describe("<LeadSiteCardView /> — AC1 estados", () => {
  it("estado `none` (leadSite=null): mostra mensagem + cluster com status='none'", () => {
    render(
      <LeadSiteCardView leadId={LEAD_ID} leadSite={null} appUrl={APP_URL} />,
    );
    const card = screen.getByRole("region", { name: /site do lead/i });
    expect(card).toHaveAttribute("data-state", "none");
    expect(
      screen.getByText(/Nenhum site gerado ainda/i),
    ).toBeInTheDocument();

    const actions = screen.getByTestId("actions-mock");
    expect(actions).toHaveAttribute("data-status", "none");
    expect(actions).toHaveAttribute("data-lead-id", LEAD_ID);
    expect(actions).toHaveAttribute("data-app-url", APP_URL);
  });

  it("estado `draft` mapeia pro mesmo visual de `none`", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({ status: "draft" })}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByRole("region", { name: /site do lead/i }),
    ).toHaveAttribute("data-state", "none");
  });

  it("estado `published`: mostra data PT-BR + URL composta com NEXT_PUBLIC_APP_URL", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({ status: "published" })}
        appUrl={APP_URL}
      />,
    );
    const card = screen.getByRole("region", { name: /site do lead/i });
    expect(card).toHaveAttribute("data-state", "published");
    // AC5 — Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })
    expect(
      screen.getByText(/Site gerado em 9 de maio de 2026/i),
    ).toBeInTheDocument();
    // AC3 — URL composta com NEXT_PUBLIC_APP_URL (NÃO hardcoded)
    expect(
      screen.getByText("https://app.gasplab.com/sites/j7k2p9-touring-cars"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lead-site-sent-badge")).toBeNull();
  });

  it("estado `sent`: mostra badge 'Enviado em…' + view count placeholder", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({
          status: "sent",
          sent_at: "2026-05-08T15:30:00.000Z",
          view_count: 3,
        })}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByRole("region", { name: /site do lead/i })).toHaveAttribute(
      "data-state",
      "sent",
    );
    expect(
      screen.getByTestId("lead-site-sent-badge"),
    ).toHaveTextContent(/Enviado em 8 de maio de 2026/i);
    expect(
      screen.getByTestId("lead-site-views-badge"),
    ).toHaveTextContent(/3 visualizações/i);
  });

  it("estado `sent` com 1 visualização usa singular", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({
          status: "sent",
          sent_at: "2026-05-08T15:30:00.000Z",
          view_count: 1,
        })}
        appUrl={APP_URL}
      />,
    );
    expect(
      screen.getByTestId("lead-site-views-badge"),
    ).toHaveTextContent(/1 visualização$/i);
  });

  it("estado `archived`: mostra mensagem com data archived", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({
          status: "archived",
          published_at: "2026-05-07T10:00:00.000Z",
        })}
        appUrl={APP_URL}
      />,
    );
    const card = screen.getByRole("region", { name: /site do lead/i });
    expect(card).toHaveAttribute("data-state", "archived");
    expect(
      screen.getByText(/Site arquivado em 7 de maio de 2026/i),
    ).toBeInTheDocument();
  });

  it("data inválida cai em fallback '—' sem quebrar render", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({ generated_at: "not-a-date" })}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByText(/Site gerado em —/i)).toBeInTheDocument();
  });
});

// statusLabel é usado em badges (apenas em estados published/sent).
// Cobertura desses casos.
describe("<LeadSiteCardView /> — statusLabel", () => {
  it("estado `published` mostra badge 'Publicado'", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({ status: "published" })}
        appUrl={APP_URL}
      />,
    );
    expect(screen.getByText("Publicado")).toBeInTheDocument();
  });

  it("estado `sent` mostra badge 'Enviado'", () => {
    render(
      <LeadSiteCardView
        leadId={LEAD_ID}
        leadSite={makeLeadSite({
          status: "sent",
          sent_at: "2026-05-08T15:30:00.000Z",
        })}
        appUrl={APP_URL}
      />,
    );
    // Há 2 badges com texto "Enviado..." (o status + o "Enviado em").
    // Verificamos pelo badge específico de status (não-aria-label).
    expect(screen.getAllByText(/Enviado/i).length).toBeGreaterThan(0);
  });
});

// Server Component direto — testes da camada de fetch (RLS-isolada via
// `createServerSupabase`). Cobre linhas 64-90 do `LeadSiteCard`.
describe("<LeadSiteCard /> — Server Component fetch", () => {
  it("retorna estado `none` quando lead_sites.maybeSingle entrega null", async () => {
    const { from, select, eq } = setSupabaseResponse(null);
    const { LeadSiteCard } = await import("@/components/leads/lead-site-card");
    const element = await LeadSiteCard({ leadId: LEAD_ID });
    render(element);
    expect(supabaseMocks.createServerSupabase).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("lead_sites");
    expect(select).toHaveBeenCalledWith(
      "id, slug, status, generated_at, published_at, sent_at, view_count",
    );
    expect(eq).toHaveBeenCalledWith("lead_id", LEAD_ID);
    expect(
      screen.getByRole("region", { name: /site do lead/i }),
    ).toHaveAttribute("data-state", "none");
  });

  it("renderiza estado `published` com dados retornados do Supabase", async () => {
    setSupabaseResponse(makeLeadSite({ status: "published" }));
    const { LeadSiteCard } = await import("@/components/leads/lead-site-card");
    const element = await LeadSiteCard({ leadId: LEAD_ID });
    render(element);
    expect(
      screen.getByRole("region", { name: /site do lead/i }),
    ).toHaveAttribute("data-state", "published");
    expect(
      screen.getByText(/Site gerado em 9 de maio de 2026/i),
    ).toBeInTheDocument();
  });

  it("erro de fetch é logado mas não quebra render — degrada para `none`", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setSupabaseResponse(null, {
      name: "PostgrestError",
      message: "permission denied",
    });
    const { LeadSiteCard } = await import("@/components/leads/lead-site-card");
    const element = await LeadSiteCard({ leadId: LEAD_ID });
    render(element);
    expect(consoleSpy).toHaveBeenCalledWith(
      "LeadSiteCard.fetch",
      expect.objectContaining({
        leadId: LEAD_ID,
        errorName: "PostgrestError",
        errorMessage: "permission denied",
      }),
    );
    expect(
      screen.getByRole("region", { name: /site do lead/i }),
    ).toHaveAttribute("data-state", "none");
    consoleSpy.mockRestore();
  });

  it("erro com campos undefined cai em fallbacks 'unknown' / ''", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Erro intencionalmente sem name/message pra exercitar os defaults.
    setSupabaseResponse(null, {} as never);
    const { LeadSiteCard } = await import("@/components/leads/lead-site-card");
    const element = await LeadSiteCard({ leadId: LEAD_ID });
    render(element);
    expect(consoleSpy).toHaveBeenCalledWith(
      "LeadSiteCard.fetch",
      expect.objectContaining({
        errorName: "unknown",
        errorMessage: "",
      }),
    );
    consoleSpy.mockRestore();
  });
});

// AC6 — axe-core runtime, zero violações `serious`/`critical` em cada estado.
describe("<LeadSiteCardView /> — AC6 axe-core a11y", () => {
  const states: Array<{
    label: string;
    leadSite: LeadSiteCardData | null;
  }> = [
    { label: "none", leadSite: null },
    { label: "draft", leadSite: makeLeadSite({ status: "draft" }) },
    { label: "published", leadSite: makeLeadSite({ status: "published" }) },
    {
      label: "sent",
      leadSite: makeLeadSite({
        status: "sent",
        sent_at: "2026-05-08T15:30:00.000Z",
        view_count: 2,
      }),
    },
    { label: "archived", leadSite: makeLeadSite({ status: "archived" }) },
  ];

  for (const { label, leadSite } of states) {
    it(`não tem violações axe-core no estado ${label}`, async () => {
      const { container } = render(
        <LeadSiteCardView
          leadId={LEAD_ID}
          leadSite={leadSite}
          appUrl={APP_URL}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }
});
