# Sitebrief — Agent Handover

> Last updated: 2026-05-04  
> Completed through: **Phase 1 — Multi-Site Foundation**

---

## What this project is

**Sitebrief** is a multi-site intelligence platform for agencies. It crawls N websites in parallel, parses and embeds their content, and generates decision-ready **pitch briefings** — prioritised ideas with complexity scores, hour estimates, CMS-aware hints, and the source pages they came from.

Full technical spec: `project-plan.md` (German, ~870 lines)  
Design system: `Sitebrief Design System/` — read `Sitebrief Design System/README.md` for brand rules, then `Sitebrief Design System/SKILL.md` to use it as a skill.

---

## Repository layout

```
/
├── apps/
│   ├── api/                  NestJS backend (Node 20, TypeScript)
│   │   ├── prisma/
│   │   │   ├── schema.prisma All 6 DB tables + enums
│   │   │   └── seed.ts       Demo org + admin user + 2 sites
│   │   └── src/
│   │       ├── auth/         JWT login/register/me
│   │       ├── sites/        Sites CRUD (org-scoped)
│   │       ├── crawler/      BullMQ crawl-queue, processor, rate-limiter
│   │       ├── events/       Socket.io WebSocket gateway
│   │       └── prisma/       Global PrismaService
│   └── web/                  React 18 + Vite + TypeScript frontend
│       └── src/
│           ├── api/client.ts Axios instance + shared types
│           ├── store/        Zustand: auth + socket state
│           ├── hooks/        useAuth, useSocket
│           ├── pages/        LoginPage, DashboardPage
│           └── components/
│               ├── layout/   Sidebar, Topbar
│               ├── sites/    SiteFleet, SiteTile (with crawl controls)
│               └── queue/    QueueMonitor
├── docker-compose.yml        PostgreSQL 16 (pgvector) + Redis 7
├── .env.example              Copy to .env before first run
├── project-plan.md           Full technical spec (source of truth)
└── Sitebrief Design System/  Brand + UI kit (design tokens, JSX components)
```

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20 |
| Backend framework | NestJS 10 + TypeScript |
| Queue | BullMQ + Redis 7 |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 + pgvector (via Docker) |
| WebSocket | Socket.io (NestJS gateway) |
| Frontend | React 18, Vite, TypeScript |
| Server state | TanStack Query v5 |
| Global state | Zustand |
| Router | React Router v6 |
| Styling | CSS custom properties (design tokens in `apps/web/src/styles/tokens.css`) |

---

## How to run locally

**Prerequisites:** Docker, Node.js 20, npm 10+

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Copy env (already done; only needed on a fresh clone)
cp .env.example .env

# 3. Push schema and seed demo data
npm run db:push    # creates tables
npm run db:seed    # creates org + admin@sitebrief.dev / password123 + 2 sites

# 4. Start both apps
npm run dev
#   API  → http://localhost:3001/api/v1
#   Web  → http://localhost:5173
```

---

## API reference (Phase 1 endpoints)

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <jwt>` on all routes except `/auth/login` and `/auth/register`

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, user }` |
| POST | `/auth/register` | `{ email, password, name, orgName }` → `{ accessToken, user }` |
| GET | `/auth/me` | Current user + org |
| GET | `/sites` | All sites for the authed org |
| POST | `/sites` | `{ name, url, cms?, priority? }` |
| GET | `/sites/:id` | Site detail + last 10 crawl jobs |
| PATCH | `/sites/:id` | `{ name?, cms?, priority? }` |
| DELETE | `/sites/:id` | Cascade deletes pages + ideas |
| POST | `/sites/:siteId/crawl` | Start crawl `{ depth? }` → `{ jobId, status }` |
| DELETE | `/sites/:siteId/crawl` | Stop active crawl |
| GET | `/sites/:siteId/crawl/status` | Job status + queue stats |
| GET | `/sites/:siteId/pages` | Crawled pages for a site |

---

## WebSocket events (Socket.io)

Connect with `query: { orgId }` — client is auto-joined to `org:<orgId>` room.

| Event | Direction | Payload |
|---|---|---|
| `job.update` | Server → Client | `{ jobId, siteId, status, progress }` |
| `crawl.page` | Server → Client | `{ siteId, url, pageType }` |
| `queue.stats` | Server → Client | `{ crawl, parse, ideas, workers }` |
| `error.new` | Server → Client | `{ siteId, type, message, retryable }` |

---

## Phase progress

| Phase | Weeks | Status | Notes |
|---|---|---|---|
| **1 — Multi-Site Foundation** | W1–3 | **Done** | Crawler, auth, sites CRUD, WebSocket, dashboard UI |
| **2 — Parse & Embed Pipeline** | W4–6 | Not started | See below |
| **3 — Ideas Engine** | W7–10 | Not started | Needs OpenAI key |
| **4 — Dashboard v2 + Realtime** | W11–13 | Not started | |
| **5 — Scheduling & Automation** | W14–15 | Not started | |

---

## Phase 2 — what to build next

**Goal:** Structured content, embeddings, page tree in UI.

### Backend tasks

1. **`parse-queue`** — add a second BullMQ queue in `CrawlerModule` (or a new `ParserModule`).  
   Trigger a `parse:extract` job after each page is saved in `CrawlProcessor`.

2. **Parse jobs** (5 workers, no external rate limit):
   - `parse:extract` — extract title, body text, meta from stored HTML  
   - `parse:clean` — strip `<nav>`, `<header>`, `<footer>`, `<aside>`, elements with class `menu|sidebar|cookie|banner`; keep `<main>`, `<article>`, `[role="main"]`
   - `parse:classify` — refine page type (extend `classifyPage` in `crawl.processor.ts`)
   - `parse:embed` — call OpenAI `text-embedding-3-small`, store 1536-dim vector in pgvector

3. **pgvector** — add `embedding Unsupported("vector(1536)")` column to `Page` and `Idea` in `schema.prisma`. Run `prisma migrate dev`. Create HNSW index:
   ```sql
   CREATE INDEX ON pages USING hnsw (embedding vector_cosine_ops);
   ```

4. **New endpoint** — `GET /sites/:id/pages` already exists; add `?type=` filter and return `parsedAt`, `type`, `meta`.

### Frontend tasks

1. **Site Detail Drawer** — slide-in panel (480px), triggered from `SiteTile`. Show tabs: Pages | Crawl history.
2. **Page tree** — list pages grouped by `type` with type icons (landing/blog/product/docs/other).
3. **Activity Stream** — basic list of recent `crawl.page` WebSocket events per site.
4. **Crawl history timeline** — last 10 `crawlJobs` with status + duration.

### Environment variables needed for Phase 2

```env
OPENAI_API_KEY=sk-...   # for parse:embed
```

---

## Design system usage

All UI work must follow `Sitebrief Design System/README.md`. Key rules:

- Use CSS tokens from `apps/web/src/styles/tokens.css` (mirrored from the design system). Never hardcode hex values.
- Fonts: `var(--font-display)` (Fraunces) for headings/titles, `var(--font-ui)` (Inter) for body, `var(--font-mono)` (JetBrains Mono) for URLs/IDs/hours.
- Accent (`var(--accent)` = #E2632A) used once per screen — primary CTA or active nav only.
- Cards: `background: var(--paper-2)`, `border: 1px solid var(--rule)`, `border-radius: var(--r-lg)`, `box-shadow: var(--shadow-1)`. No colored left borders.
- Complexity badges: use `var(--low-bg)` / `var(--med-bg)` / `var(--high-bg)` with matching text colors.
- Status labels lowercase: `open`, `accepted`, `rejected`, `deferred`, `done`.
- No emoji in product UI.

Existing React components to extend (not rewrite):
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/sites/SiteTile.tsx` — add click handler for drawer
- `apps/web/src/components/sites/SiteFleet.tsx`

---

## Key files to read before touching anything

| File | Why |
|---|---|
| `project-plan.md` | Full spec: data model, API design, queue params, prompts |
| `Sitebrief Design System/README.md` | Brand voice, palette, type, layout rules |
| `apps/api/src/crawler/crawl.processor.ts` | Core crawl logic — parse queue hooks in here |
| `apps/api/prisma/schema.prisma` | Add pgvector columns here for Phase 2 |
| `apps/web/src/api/client.ts` | Shared TypeScript types for API responses |
