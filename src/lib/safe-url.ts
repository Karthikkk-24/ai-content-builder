/**
 * SSRF hardening for server-side fetches of user-influenced URLs
 * (reference images, etc.).
 */

const ALLOWED_HOST_SUFFIXES = [
  "ufs.sh",
  "utfs.io",
  "uploadthing.com",
  "img.clerk.com",
  "pollinations.ai",
] as const;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

const MAX_REFERENCE_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 10_000;

function isIpv4Literal(hostname: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function isIpv6Literal(hostname: string): boolean {
  return hostname.includes(":");
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;

  const ranges: Array<[number, number]> = [
    [ipv4ToInt("0.0.0.0")!, ipv4ToInt("0.255.255.255")!],
    [ipv4ToInt("10.0.0.0")!, ipv4ToInt("10.255.255.255")!],
    [ipv4ToInt("127.0.0.0")!, ipv4ToInt("127.255.255.255")!],
    [ipv4ToInt("169.254.0.0")!, ipv4ToInt("169.254.255.255")!],
    [ipv4ToInt("172.16.0.0")!, ipv4ToInt("172.31.255.255")!],
    [ipv4ToInt("192.168.0.0")!, ipv4ToInt("192.168.255.255")!],
    [ipv4ToInt("100.64.0.0")!, ipv4ToInt("100.127.255.255")!],
    [ipv4ToInt("192.0.0.0")!, ipv4ToInt("192.0.0.255")!],
    [ipv4ToInt("192.0.2.0")!, ipv4ToInt("192.0.2.255")!],
    [ipv4ToInt("198.18.0.0")!, ipv4ToInt("198.19.255.255")!],
    [ipv4ToInt("198.51.100.0")!, ipv4ToInt("198.51.100.255")!],
    [ipv4ToInt("203.0.113.0")!, ipv4ToInt("203.0.113.255")!],
    [ipv4ToInt("224.0.0.0")!, ipv4ToInt("255.255.255.255")!],
  ];

  return ranges.some(([start, end]) => n >= start && n <= end);
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  if (!host || BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }

  if (isIpv4Literal(host)) {
    return false; // never allow raw IPs (blocks metadata / private ranges)
  }

  if (isIpv6Literal(host)) {
    return false;
  }

  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

export type SafeUrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Validate that a URL is safe to fetch server-side (SSRF allowlist).
 * Data URLs are not validated here — callers handle them separately.
 */
export function assertSafeExternalImageUrl(raw: string): SafeUrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only HTTPS URLs are allowed" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials are not allowed" };
  }

  if (!hostAllowed(url.hostname)) {
    return { ok: false, reason: "Host is not on the allowlist" };
  }

  return { ok: true, url };
}

export function isAllowedDataImageUrl(raw: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(raw);
}

/**
 * Fetch an allowlisted image URL with size + content-type guards.
 * Redirects are rejected (`redirect: "error"`).
 */
export async function fetchAllowlistedImage(
  rawUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const check = assertSafeExternalImageUrl(rawUrl);
  if (!check.ok) {
    console.warn("Blocked SSRF-prone image fetch:", check.reason, rawUrl);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(check.url.toString(), {
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAX_REFERENCE_BYTES) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_REFERENCE_BYTES) {
      return null;
    }

    return { buffer, contentType: contentType.split(";")[0].trim() || "image/jpeg" };
  } catch (error) {
    console.warn("Allowlisted image fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export { ALLOWED_HOST_SUFFIXES, MAX_REFERENCE_BYTES };
