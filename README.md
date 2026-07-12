# ContentAI — Build & Generate Content with AI

A full-stack Next.js application for building content and generating AI-powered posters, tweets, photos, and more.

## Features

- **Landing page** with marketing content
- **Clerk authentication** (sign in / sign up)
- **Admin-style dashboard** with animated sidebar and navbar
- **Content Builder** — block-based editor with Markdown export
- **AI Generator** — posters, tweets, photos, prompt upgrade, blog outlines, social captions
- **Reference image upload** for style-guided generation
- **Prompt upgrade** — enhance rough prompts with AI
- **Monochrome design** — white/black theme with Lucide line icons

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Clerk (auth) + Neon Postgres (database) + Drizzle ORM
- Vercel AI SDK (Gemini + Groq)
- Pollinations Flux (free image generation)
- Uploadthing (file uploads)
- Upstash Redis (caching, rate limits, session metadata)
- Framer Motion (sidebar animations)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

**Required services:**

| Service | Purpose | Sign up |
|---------|---------|---------|
| Clerk | Authentication | [clerk.com](https://clerk.com) |
| Neon | Postgres database | [neon.tech](https://neon.tech) |
| Google AI Studio | Gemini Flash (text + vision) | [ai.google.dev](https://ai.google.dev) |
| Groq | Llama 3.3 fallback (text) | [console.groq.com](https://console.groq.com) |
| Upstash Redis | Caching & rate limiting (optional) | [console.upstash.com](https://console.upstash.com) |
| Pollinations | Free image generation (optional key) | [auth.pollinations.ai](https://auth.pollinations.ai) |

### 3. Set up the database

Your Neon `DATABASE_URL` goes in `.env.local` (never commit this file).

Run migrations against your Neon database:

```bash
# Option A: push schema directly
npm run db:push

# Option B: apply generated migration
psql $DATABASE_URL -f drizzle/0000_init.sql
```

The schema creates four tables: `users`, `content_projects`, `generations`, and `reference_images`.

### 4. Configure Clerk Google OAuth

In the [Clerk Dashboard](https://dashboard.clerk.com):

1. Go to **User & Authentication → Social Connections**
2. Enable **Google**
3. For local dev, add these URLs under **Paths** (or use Clerk's development instance defaults):
   - Sign-in URL: `http://localhost:3000/sign-in`
   - Sign-up URL: `http://localhost:3000/sign-up`
   - After sign-in URL: `http://localhost:3000/dashboard`

The app handles Google OAuth via dedicated SSO callback routes at `/sign-in/sso-callback` and `/sign-up/sso-callback`.

### 5. Configure Clerk webhook

In your Clerk dashboard, add a webhook endpoint:

```
https://your-domain.com/api/webhooks/clerk
```

Subscribe to `user.created` and `user.updated` events. Copy the signing secret to `CLERK_WEBHOOK_SECRET`.

### 6. Configure session persistence (recommended)

In Clerk Dashboard → **Sessions**:

- Set session lifetime to **30 days**
- Enable **multi-session** if you use multiple devices

The app includes a `SessionKeeper` that refreshes your Clerk token every 5 minutes so you stay signed in.

### 7. Configure Redis (optional, recommended for production)

Create a free Upstash Redis database and add to `.env.local`:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Redis powers:
- Dashboard & profile caching (faster page loads)
- Distributed rate limiting across server instances
- Session activity tracking

Without Redis, the app falls back to in-memory caching locally.

### 8. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI Provider Strategy

| Use case | Primary | Fallback |
|----------|---------|----------|
| Text generation | Gemini 3.5 Flash | Groq Llama 3.3 70B |
| Prompt upgrade | Gemini 3.5 Flash | Groq Llama 3.3 70B |
| Image generation | Pollinations Flux | — |
| Reference analysis | Gemini 3.5 Flash (vision) | — |

## Project Structure

```
src/
  app/
    (marketing)/     # Landing page
    (auth)/          # Sign in / sign up
    (app)/           # Authenticated app (dashboard, builder, generate, profile)
    api/             # API routes
  components/
    layout/          # Navbar, sidebar, app shell
    generate/        # Generator layout
    builder/         # Content builder
    upload/          # Reference image uploader
    ui/              # UI primitives
  lib/
    ai/              # AI provider router & prompts
    db/              # Drizzle schema & client
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

MIT
