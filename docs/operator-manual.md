# Operator manual

Runbooks for operating ContentAI in staging/production.

## Health & uptime

```bash
curl -sS https://<host>/api/health/live
curl -sS https://<host>/api/health/ready
```

- **live** must be 200 whenever the Node process is up.
- **ready** must be 200 only when Neon and Redis (or the intentional memory Redis fallback) respond. Load balancers should use **ready** for traffic.

If ready returns 503, inspect `checks.database` / `checks.redis` in the JSON body.

## Rotate AI keys

| Key | Used for | Where |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini text + vision | Google AI Studio |
| `GROQ_API_KEY` | Llama text fallback | Groq console |
| `POLLINATIONS_API_KEY` | Optional authenticated image fetch (server-side only) | Pollinations |
| `OPENAI_API_KEY` | Optional DALL·E 3 images | OpenAI |
| `RECRAFT_API_KEY` | Optional Recraft images | Recraft |
| `STABILITY_API_KEY` | Optional Stability Core images | Stability |

Steps:

1. Create a new key in the provider console.
2. Update the deployment env (Vercel/host) — never commit keys.
3. Redeploy or restart so Next.js picks up the new value.
4. Smoke-test: tweet generate (Gemini path) and, with Groq only temporarily unset Google key in a staging slot, confirm Groq fallback.
5. Revoke the old key after successful smoke tests.

Missing Google key breaks text + vision. Missing Groq only removes fallback. Missing Pollinations key still allows key-free image URLs when Uploadthing is absent; prefer Uploadthing rehost in production.

## Rotate Clerk secrets

1. Rotate `CLERK_SECRET_KEY` / publishable key in the Clerk dashboard and deployment env together.
2. Rotate `CLERK_WEBHOOK_SECRET` and update the Clerk webhook endpoint signing secret in the same change window.
3. Confirm `POST /api/webhooks/clerk` with a test `user.updated` event (Clerk dashboard → Webhooks → testing).
4. Confirm sign-in still reaches `/dashboard`.

Webhook failures (missing secret, bad Svix signature, stale timestamp) are logged as structured `security` / `webhook_failure` events.

## Flush Redis cache

Upstash REST:

```bash
# Example: delete a user's dashboard + generation caches
# Prefer Upstash console CLI or REST DEL for known key patterns:
# dashboard:stats:{userId}
# user:generations:{userId}
# user:generations:{userId}:20
# user:generations:{userId}:50
# user:profile:{userId}
# user:synced:{userId}
# session:active:{userId}  — last activity JSON { activeAt }; TTL = sessionMaxAgeDays
# ratelimit:{userId}:{route}
```

Inspect a user’s Redis session stamp via authenticated `GET /api/session/heartbeat` (`activeAt`, `isActive`, `maxAgeDays`). Application helper: `invalidateUserCache(userId)` in `src/lib/cache.ts` clears dashboard + generation keys after writes.

If Redis is misconfigured in production, rate limiting **fail-closes** (requests denied). Fix env (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) immediately; the UI shows a banner when Redis is missing in production (`AppShell`).

## Recover from provider outage

### Gemini down / quota

- Groq fallback runs automatically when Gemini models exhaust retries.
- Ensure `GROQ_API_KEY` is set in production.
- Temporarily lower traffic or tighten rate limits if both providers throttle.

### Groq down

- Gemini remains primary; no action unless Gemini also fails.
- Users see `AI_FAILED` style API errors — check structured logs (`ai_failure`).

### Pollinations / image outage

- Photo/poster routes fail until the provider recovers.
- Confirm Uploadthing token is set so successful bytes are rehosted (and keyed Pollinations URLs are never returned to clients).
- Longer-term: add alternate image providers (tracked as product backlog).

### Neon outage

- `/api/health/ready` → 503.
- Pause deploys; wait for Neon status. Webhooks may 500 and retry — that is expected.

## Database migrations

```bash
# Apply SQL migrations in order against Neon
psql "$DATABASE_URL" -f drizzle/0000_init.sql
# … through latest, e.g. 0004_user_preferences.sql

# Or push schema (dev)
npm run db:push
```

After deploy, confirm ready health and a smoke login.

## Account deletion & GDPR export

- Users can export JSON via Settings → Export (`POST /api/account/export`).
- Self-serve delete: Settings confirmation `DELETE MY ACCOUNT` → Clerk `users.deleteUser` + local `users` row delete (cascades).
- Clerk `user.deleted` webhook also deletes the local user if deletion starts from Clerk.

## Useful commands

```bash
npm run test
npm run test:coverage
npx tsc --noEmit
npm run lint
npm run build
```

CI: `.github/workflows/ci.yml` runs coverage + typecheck on PRs and `main`.
