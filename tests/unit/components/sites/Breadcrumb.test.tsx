import { render, screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "@/components/sites/Breadcrumb";

expect.extend(toHaveNoViolations);

describe("<Breadcrumb />", () => {
  it("renderiza links intermediários e página atual sem link", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Início", href: "/sites/loja" },
          { label: "Estoque", href: "/sites/loja/estoque" },
          { label: "Toyota Corolla 2022" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(
      within(nav).getByRole("link", { name: "Início" }),
    ).toHaveAttribute("href", "/sites/loja");
    expect(
      within(nav).getByRole("link", { name: "Estoque" }),
    ).toHaveAttribute("href", "/sites/loja/estoque");
    expect(within(nav).getByText("Toyota Corolla 2022")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("zero violations a11y", async () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Início", href: "/sites/loja" },
          { label: "Estoque" },
        ]}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
