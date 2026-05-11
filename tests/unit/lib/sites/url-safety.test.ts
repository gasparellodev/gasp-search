import { describe, expect, it } from "vitest";

import { isPrivateOrLinkLocalHost } from "@/lib/sites/url-safety";

describe("isPrivateOrLinkLocalHost()", () => {
  it("permite hosts públicos http(s)", () => {
    expect(isPrivateOrLinkLocalHost("https://cdn.example.com/hero.png")).toBe(
      false,
    );
    expect(isPrivateOrLinkLocalHost("http://203.0.113.10/hero.png")).toBe(
      false,
    );
  });

  it("bloqueia RFC1918 IPv4 ranges", () => {
    expect(isPrivateOrLinkLocalHost("https://10.0.0.1/hero.png")).toBe(true);
    expect(isPrivateOrLinkLocalHost("https://172.16.0.1/hero.png")).toBe(true);
    expect(isPrivateOrLinkLocalHost("https://172.31.255.255/hero.png")).toBe(
      true,
    );
    expect(isPrivateOrLinkLocalHost("https://192.168.10.2/hero.png")).toBe(
      true,
    );
  });

  it("bloqueia link-local metadata IPv4", () => {
    expect(
      isPrivateOrLinkLocalHost(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      ),
    ).toBe(true);
  });

  it("bloqueia loopback e unspecified hosts", () => {
    expect(isPrivateOrLinkLocalHost("http://127.0.0.1:3000/hero.png")).toBe(
      true,
    );
    expect(isPrivateOrLinkLocalHost("http://[::1]/hero.png")).toBe(true);
    expect(isPrivateOrLinkLocalHost("http://0.0.0.0/hero.png")).toBe(true);
  });

  it("bloqueia hostnames especiais de metadata", () => {
    expect(isPrivateOrLinkLocalHost("http://metadata/computeMetadata/v1")).toBe(
      true,
    );
    expect(
      isPrivateOrLinkLocalHost("http://metadata.google.internal/computeMetadata/v1"),
    ).toBe(true);
  });

  it("bloqueia hostname bem-formado com IP privado/link-local embutido", () => {
    expect(
      isPrivateOrLinkLocalHost("http://attacker.com.169.254.169.254/hero.png"),
    ).toBe(true);
    expect(
      isPrivateOrLinkLocalHost("http://cdn.example.com.192.168.0.1/hero.png"),
    ).toBe(true);
  });

  it("trata URL inválida como não bloqueada pelo helper de host", () => {
    expect(isPrivateOrLinkLocalHost("not a url")).toBe(false);
  });
});
