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
| Uploadthing | Reference image uploads | [uploadthing.com](https://uploadthing.com) |
| Pollinations | Free image generation (optional key) | [auth.pollinations.ai](https://auth.pollinations.ai) |

### 3. Set up the database

Run the migration SQL against your Neon database:

```bash
# Using psql or Neon SQL editor, run:
# drizzle/0000_init.sql
```

Or use Drizzle Kit:

```bash
npx drizzle-kit push
```

### 4. Configure Clerk webhook

In your Clerk dashboard, add a webhook endpoint:

```
https://your-domain.com/api/webhooks/clerk
```

Subscribe to `user.created` and `user.updated` events. Copy the signing secret to `CLERK_WEBHOOK_SECRET`.

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI Provider Strategy

| Use case | Primary | Fallback |
|----------|---------|----------|
| Text generation | Gemini 2.0 Flash | Groq Llama 3.3 70B |
| Prompt upgrade | Gemini 2.0 Flash | Groq Llama 3.3 70B |
| Image generation | Pollinations Flux | — |
| Reference analysis | Gemini 2.0 Flash (vision) | — |

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
