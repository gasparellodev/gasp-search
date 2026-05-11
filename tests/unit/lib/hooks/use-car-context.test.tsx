import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCarContext } from "@/lib/hooks/use-car-context";

import { SITE_FIXTURE } from "../../components/sites/site-fixtures";

const SLUG = "j7k2p9-touring-cars";
const car = SITE_FIXTURE.cars[0]!;

describe("useCarContext()", () => {
  it("normaliza dados do carro, parcela e href WhatsApp vehicle", () => {
    const { result } = renderHook(() =>
      useCarContext(SLUG, car.slug, {
        businessName: SITE_FIXTURE.business_name,
        whatsapp: SITE_FIXTURE.whatsapp,
        car,
      }),
    );

    expect(result.current.vehicleLabel).toBe("Toyota Corolla 2022");
    expect(result.current.priceLabel).toMatch(/R\$\s?119\.900/);
    expect(result.current.installmentLabel).toMatch(/^48x de R\$/);
    expect(result.current.whatsappHref).toContain("utm_campaign=vehicle");
    expect(result.current.whatsappHref).toContain("utm_content=floating-cta");
    expect(result.current.whatsappHref).toContain(`utm_term=${SLUG}`);
  });

  it("lança quando o carSlug solicitado não corresponde ao contexto serializado", () => {
    expect(() =>
      renderHook(() =>
        useCarContext(SLUG, "outro-carro", {
          businessName: SITE_FIXTURE.business_name,
          whatsapp: SITE_FIXTURE.whatsapp,
          car,
        }),
      ),
    ).toThrow("useCarContext: carSlug mismatch");
  });
});
