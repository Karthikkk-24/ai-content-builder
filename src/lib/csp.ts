/**
 * Clerk middleware injects a base CSP (scripts, Clerk FAPI, Cloudflare challenges,
 * protect.clerk.com). These directives are merged on top for app hosts.
 *
 * Allowed origins (beyond Clerk defaults):
 * - Images: Uploadthing (`*.ufs.sh`, utfs.io, `*.uploadthing.com`), Pollinations
 * - Connect: Uploadthing ingest/API hosts used by the uploader client
 * - Hardening: object-src none, frame-ancestors none (complements X-Frame-Options)
 */
export const appContentSecurityPolicy = {
  directives: {
    "img-src": [
      "data:",
      "blob:",
      "https://*.ufs.sh",
      "https://utfs.io",
      "https://uploadthing.com",
      "https://*.uploadthing.com",
      "https://image.pollinations.ai",
      "https://*.pollinations.ai",
    ],
    "connect-src": [
      "https://uploadthing.com",
      "https://*.uploadthing.com",
      "https://*.ufs.sh",
      "https://utfs.io",
    ],
    "object-src": ["none"],
    "base-uri": ["self"],
    "frame-ancestors": ["none"],
  },
} as const;

