import { describe, expect, it } from "vitest";

import { parseSetArgs } from "@/scripts/set-visual-identity";

describe("parseSetArgs", () => {
  it("parses slug and all asset paths from kebab-case flags", () => {
    expect(
      parseSetArgs([
        "abc12345-loja",
        "--hero=/tmp/hero.png",
        "--about=/tmp/about.png",
        "--contact=/tmp/contact.png",
        "--category-sedan=/tmp/sedan.png",
      ]),
    ).toEqual({
      slug: "abc12345-loja",
      assets: {
        hero: "/tmp/hero.png",
        about: "/tmp/about.png",
        contact: "/tmp/contact.png",
        category_sedan: "/tmp/sedan.png",
      },
    });
  });

  it("supports multiple categories via --category-X flags", () => {
    expect(
      parseSetArgs([
        "abc",
        "--hero=h.png",
        "--about=a.png",
        "--contact=c.png",
        "--category-suv=suv.png",
        "--category-pickup=pickup.png",
      ]),
    ).toEqual({
      slug: "abc",
      assets: {
        hero: "h.png",
        about: "a.png",
        contact: "c.png",
        category_suv: "suv.png",
        category_pickup: "pickup.png",
      },
    });
  });

  it("throws when slug is missing", () => {
    expect(() =>
      parseSetArgs(["--hero=h.png", "--about=a.png", "--contact=c.png"]),
    ).toThrow(/slug/i);
  });

  it("throws when an unknown flag is passed", () => {
    expect(() =>
      parseSetArgs(["abc", "--hero=h.png", "--mystery=x.png"]),
    ).toThrow(/--mystery/);
  });

  it("throws when a flag has no value (missing '=')", () => {
    expect(() => parseSetArgs(["abc", "--hero"])).toThrow(/--hero/);
  });
});
