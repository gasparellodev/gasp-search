const SPECIAL_BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);

/**
 * Detecta hosts que não devem ser buscados por surfaces server-side/Edge.
 *
 * A validação é propositalmente local e Edge-compatible: não faz DNS lookup.
 * Ela bloqueia IPs literais privados/link-local/loopback e hostnames
 * reservados de metadata cloud. Hostnames públicos normais retornam false.
 */
export function isPrivateOrLinkLocalHost(input: string | URL): boolean {
  const hostname = getHostname(input);
  if (!hostname) return false;

  const host = normalizeHostname(hostname);
  if (SPECIAL_BLOCKED_HOSTS.has(host)) return true;
  if (host === "::1") return true;

  const ipv4 = parseIpv4(host);
  if (ipv4) return isBlockedIpv4(ipv4);

  const embeddedIpv4 = parseTrailingIpv4Labels(host);
  if (embeddedIpv4) return isBlockedIpv4(embeddedIpv4);

  return false;
}

function getHostname(input: string | URL): string | null {
  if (input instanceof URL) return input.hostname;
  try {
    return new URL(input).hostname;
  } catch {
    return extractRawHostname(input);
  }
}

function extractRawHostname(input: string): string | null {
  const match = input.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  const authority = match?.[1];
  if (!authority) return null;

  const withoutCredentials = authority.split("@").at(-1) ?? "";
  if (withoutCredentials.startsWith("[")) {
    const end = withoutCredentials.indexOf("]");
    return end > 0 ? withoutCredentials.slice(0, end + 1) : null;
  }

  return withoutCredentials.split(":")[0] ?? null;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : null;
  });

  if (octets.some((octet) => octet === null)) return null;
  return octets as [number, number, number, number];
}

function parseTrailingIpv4Labels(
  host: string,
): [number, number, number, number] | null {
  const labels = host.split(".");
  if (labels.length < 5) return null;
  return parseIpv4(labels.slice(-4).join("."));
}

function isBlockedIpv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}
