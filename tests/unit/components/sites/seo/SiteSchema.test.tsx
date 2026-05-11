/**
 * `<SiteSchema>` Server Component — unit tests (issue #211 / Sprint 1 / #S1).
 *
 * Cobre:
 *  - Render base: emite `<script type="application/ld+json">`.
 *  - Conteúdo é JSON parseável.
 *  - XSS guard: `</script>` no input → escapado pra `<\/script>`.
 *  - Array de schemas → 1 script por entry.
 *  - Single schema object → render direto.
 *  - U+2028 / U+2029 escapados.
 */

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { SiteSchema } from "@/components/sites/seo/SiteSchema";

describe("<SiteSchema>", () => {
  it("renderiza <script type='application/ld+json'>", () => {
    const { container } = render(
      <SiteSchema
        schemas={{
          "@context": "https://schema.org",
          "@type": "Thing",
          name: "Test",
        }}
      />,
    );
    const script = container.querySelector(
      "script[type='application/ld+json']",
    );
    expect(script).not.toBeNull();
  });

  it("conteúdo é JSON parseável com shape correto (single schema)", () => {
    const { container } = render(
      <SiteSchema
        schemas={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Acme",
        }}
      />,
    );
    const script = container.querySelector(
      "script[type='application/ld+json']",
    );
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.textContent ?? "");
    expect(parsed).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme",
    });
  });

  it("XSS guard: `</script>` em string do schema vira `<\\/script>` na serialização", () => {
    const malicious = {
      "@context": "https://schema.org",
      "@type": "Thing",
      // Tentativa de breakout: copy do site contém literal `</script>`.
      name: 'Foo</script><script>alert(1)</script>',
    };
    const { container } = render(<SiteSchema schemas={malicious} />);
    const script = container.querySelector(
      "script[type='application/ld+json']",
    );
    expect(script).not.toBeNull();
    const innerHTML = script!.innerHTML;
    // O closing tag literal nunca pode aparecer cru — sempre escaped.
    expect(innerHTML).not.toContain("</script>");
    expect(innerHTML).toContain("<\\/script>");
    // E o JSON continua parseável (escape unicode válido).
    const parsed = JSON.parse(script!.textContent ?? "");
    expect(parsed.name).toContain("</script>");
  });

  it("XSS guard cobre variantes de case (</ScRiPt>)", () => {
    const malicious = {
      "@context": "https://schema.org",
      "@type": "Thing",
      name: "x</ScRiPt>",
    };
    const { container } = render(<SiteSchema schemas={malicious} />);
    const script = container.querySelector(
      "script[type='application/ld+json']",
    );
    const innerHTML = script!.innerHTML;
    expect(innerHTML).not.toMatch(/<\/script/i);
  });

  it("array de schemas → renderiza N <script> tags (1 por entry)", () => {
    const arr = [
      { "@context": "https://schema.org", "@type": "Thing", name: "A" },
      { "@context": "https://schema.org", "@type": "Thing", name: "B" },
    ] as const;
    const { container } = render(<SiteSchema schemas={[...arr]} />);
    const scripts = container.querySelectorAll(
      "script[type='application/ld+json']",
    );
    expect(scripts.length).toBe(2);
    const names = Array.from(scripts).map(
      (s) => JSON.parse(s.textContent ?? "{}").name,
    );
    expect(names).toEqual(["A", "B"]);
  });

  it("graph object com @graph array → render como single script (não trata como array)", () => {
    const graph = {
      "@context": "https://schema.org" as const,
      "@graph": [
        { "@type": "AutoDealer", name: "X" },
        { "@type": "Organization", name: "Y" },
      ],
    };
    const { container } = render(<SiteSchema schemas={graph} />);
    const scripts = container.querySelectorAll(
      "script[type='application/ld+json']",
    );
    expect(scripts.length).toBe(1);
    const parsed = JSON.parse(scripts[0]!.textContent ?? "");
    expect(parsed["@graph"]).toHaveLength(2);
  });

  it("U+2028/U+2029 line separators são escaped (JSON.parse não falha)", () => {
    // Esses chars são válidos em JSON mas quebram parser JS legacy em
    // alguns browsers. Defesa adicional ao escape do `</script>`.
    const schema = {
      "@context": "https://schema.org",
      "@type": "Thing",
      name: "foo\u2028bar\u2029baz",
    };
    const { container } = render(<SiteSchema schemas={schema} />);
    const script = container.querySelector(
      "script[type='application/ld+json']",
    );
    expect(script).not.toBeNull();
    // Raw chars not present — replaced by escape sequence literals.
    expect(script!.innerHTML).not.toContain(String.fromCharCode(0x2028));
    expect(script!.innerHTML).not.toContain(String.fromCharCode(0x2029));
    expect(script!.innerHTML).toContain("\\u2028");
    expect(script!.innerHTML).toContain("\\u2029");
    // JSON ainda parseável e roundtrip preserva chars (JSON.parse aceita
    // `\u2028` como escape válido).
    const parsed = JSON.parse(script!.textContent ?? "");
    expect(parsed.name).toBe("foo\u2028bar\u2029baz");
  });
});
