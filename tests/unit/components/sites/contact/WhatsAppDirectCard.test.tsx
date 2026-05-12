import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { WhatsAppDirectCard } from "@/components/sites/contact/WhatsAppDirectCard";

expect.extend(toHaveNoViolations);

describe("<WhatsAppDirectCard />", () => {
  it("renderiza link wa.me com template general e component contact-section", () => {
    render(
      <WhatsAppDirectCard
        whatsapp="55 81 98100-0000"
        phoneDisplay="(81) 98100-0000"
        businessName="Touring Cars"
        businessSlug="touring-cars"
      />,
    );

    const link = screen.getByRole("link", { name: /chamar no whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/5581981000000\?text=/);
    expect(link.getAttribute("href")).toContain("utm_content=contact-section");
  });

  it("não tem violações axe-core", async () => {
    const { container } = render(
      <WhatsAppDirectCard
        whatsapp="5581981000000"
        phoneDisplay="(81) 98100-0000"
        businessName="Touring Cars"
        businessSlug="touring-cars"
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }, 15_000);
});
