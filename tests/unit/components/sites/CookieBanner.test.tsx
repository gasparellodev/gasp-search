import { axe, toHaveNoViolations } from "jest-axe";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CookieBanner } from "@/components/sites/CookieBanner";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "@/lib/hooks/use-consent";

const recordConsentDecisionMock = vi.hoisted(() => vi.fn(async () => ({ ok: true })));

vi.mock("@/app/actions/consent-audit", () => ({
  recordConsentDecision: recordConsentDecisionMock,
}));

expect.extend(toHaveNoViolations);

function readStoredConsent() {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (!raw) throw new Error("missing consent");
  return JSON.parse(raw) as {
    version: string;
    action: string;
    categories: {
      necessary: boolean;
      analytics: boolean;
      marketing: boolean;
    };
  };
}

describe("<CookieBanner />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("aparece na primeira visita com copy e ações PT-BR", () => {
    render(<CookieBanner />);

    expect(
      screen.getByText(
        "Usamos cookies para melhorar sua experiência. Você pode aceitar todos ou personalizar.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceitar todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personalizar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apenas necessários" }),
    ).toBeInTheDocument();
  });

  it("aceitar todos persiste analytics e marketing como opt-in", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Aceitar todos" }));

    const stored = readStoredConsent();
    expect(stored).toMatchObject({
      version: CONSENT_VERSION,
      action: "accept_all",
      categories: {
        necessary: true,
        analytics: true,
        marketing: true,
      },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
    });
    expect(recordConsentDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "accept_all",
        version: CONSENT_VERSION,
      }),
    );
  });

  it("apenas necessários não concede analytics nem marketing", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Apenas necessários" }));

    expect(readStoredConsent()).toMatchObject({
      action: "reject",
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
      },
    });
  });

  it("personalizar abre modal acessível e salva categorias selecionadas", async () => {
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByRole("button", { name: "Personalizar" }));

    const dialog = screen.getByRole("dialog", {
      name: "Preferências de privacidade",
    });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Necessários")).toBeChecked();

    await user.click(within(dialog).getByLabelText("Analytics"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar escolhas" }));

    expect(readStoredConsent()).toMatchObject({
      action: "accept_selected",
      categories: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
    });
  });

  it("não aparece quando já existe decisão persistida", () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        version: CONSENT_VERSION,
        action: "reject",
        categories: {
          necessary: true,
          analytics: false,
          marketing: false,
        },
        updatedAt: "2026-05-12T00:00:00.000Z",
      }),
    );

    render(<CookieBanner />);

    expect(screen.queryByTestId("cookie-banner")).not.toBeInTheDocument();
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(<CookieBanner />);

    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
