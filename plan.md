# Sitebrief — Agent Handover

> Last updated: 2026-05-04  
> Completed through: **Phase 2 — Parse & Embed Pipeline**

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
│   │   │   ├── schema.prisma All tables + enums + pgvector columns on Page/Idea
│   │   │   ├── migrations/   SQL: vector extension, HNSW indexes, unique(site_id,url)
│   │   │   └── seed.ts       Demo org + admin user + 2 sites
│   │   └── src/
│   │       ├── auth/         JWT login/register/me
│   │       ├── sites/        Sites CRUD (org-scoped)
│   │       ├── crawler/      BullMQ crawl-queue + parse-queue, processors, rate-limiter
│   │       ├── events/       Socket.io WebSocket gateway
│   │       └── prisma/       Global PrismaService
│   └── web/                  React 18 + Vite + TypeScript frontend
│       └── src/
│           ├── api/client.ts Axios instance + shared types
│           ├── store/        Zustand: auth + socket + crawl activity buffer
│           ├── hooks/        useAuth, useSocket
│           ├── pages/        LoginPage, DashboardPage
│           └── components/
│               ├── layout/   Sidebar, Topbar
│               ├── sites/    SiteFleet, SiteTile, SiteDetailDrawer, PageTypeIcon
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
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) |

---

## How to run locally

**Prerequisites:** Docker, Node.js 20, npm 10+

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Copy env (only needed on a fresh clone)
cp .env.example .env
# Set OPENAI_API_KEY for embeddings (optional: parse/classify still runs without it)

# 3. Apply schema, then migrations (HNSW + unique index on pages)
npm run db:push    # creates/updates tables from Prisma schema
npm run db:migrate # applies prisma/migrations/* (vector indexes)

# 4. Seed demo data
npm run db:seed    # org + admin@sitebrief.dev / password123 + 2 sites

# 5. Start both apps
npm run dev
#   API  → http://localhost:3001/api/v1
#   Web  → http://localhost:5173
```

**Note:** If `prisma migrate` fails with access errors on `localhost:5432`, another Postgres may be bound to that port. Point `DATABASE_URL` at the Docker host/port you mapped (or change the compose port mapping).

---

## API reference (Phase 1–2 endpoints)

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
| GET | `/sites/:siteId/crawl/status` | Job status + queue stats (`crawl`, `parse`, `ideas`, `workers`) |
| GET | `/sites/:siteId/pages` | Pages for a site; optional `?type=landing\|blog\|product\|docs\|other` — returns `parsedAt`, `type`, `meta` (no raw HTML or embedding vector) |

---

## WebSocket events (Socket.io)

Connect with `query: { orgId }` — client is auto-joined to `org:<orgId>` room.  
Emit `subscribe:site` with a `siteId` string to join `site:<siteId>` (used by the site detail drawer).

| Event | Direction | Payload |
|---|---|---|
| `job.update` | Server → Client | `{ jobId, siteId, status, progress }` |
| `crawl.page` | Server → Client | `{ siteId, url, pageType }` — fired after crawl and again after parse completes (refined type) |
| `queue.stats` | Server → Client | `{ crawl, parse, ideas, workers }` |
| `error.new` | Server → Client | `{ siteId, type, message, retryable }` — includes `parse_error` on final parse failure |

---

## Phase progress

| Phase | Weeks | Status | Notes |
|---|---|---|---|
| **1 — Multi-Site Foundation** | W1–3 | **Done** | Crawler, auth, sites CRUD, WebSocket, dashboard UI |
| **2 — Parse & Embed Pipeline** | W4–6 | **Done** | `parse-queue`, HTML extract/clean/classify, OpenAI embed, pgvector + HNSW, pages `?type=`, site drawer + activity + crawl timeline |
| **3 — Ideas Engine** | W7–10 | Not started | Needs OpenAI key (GPT + embeddings already wired) |
| **4 — Dashboard v2 + Realtime** | W11–13 | Not started | |
| **5 — Scheduling & Automation** | W14–15 | Not started | |

---

## Phase 2 — implementation notes (for maintainers)

- **Queues:** `crawl-queue` (3 workers) + `parse-queue` (5 workers), both registered in `CrawlerModule`. After each successful page upsert, a Bull job named `parse:extract` runs the full **extract → clean → classify → embed** pipeline in one worker invocation (matches the four logical job types from the spec).
- **Pages:** Upsert is keyed by **`@@unique([siteId, url])`**; `rawHtml` is stored on crawl and cleared after a successful parse (embedding runs before clear so retries keep HTML if OpenAI fails).
- **pgvector:** `Page.embedding` and `Idea.embedding` use Prisma `Unsupported("vector(1536)")`; writes use raw SQL. Migration `20260504120000_phase2_parse_embed` adds extension, columns, unique index, and partial HNSW indexes.
- **Frontend:** `SiteDetailDrawer` (480px), `PageTypeIcon`, crawl activity ring buffer in Zustand, `subscribe:site` on open.

---

## Phase 3 — what to build next

**Goal:** Context-aware idea generation, scoring, deduplication (see `project-plan.md` §9 Phase 3).

### Backend (high level)

1. **`ideas-queue`** — BullMQ, ~2 workers, TPM-aware rate limit per org.
2. **Jobs:** `ideas:generate`, `ideas:score`, `ideas:dedup`, `ideas:rank` (or a single pipeline job mirroring Phase 2’s pattern).
3. **GPT-4o** — Pitch-briefing prompt, context bundle from parsed pages + embeddings.
4. **Dedup** — cosine similarity vs existing `Idea.embedding` (threshold ~0.92).
5. **APIs** — `POST /sites/:id/ideas/generate`, `GET /sites/:id/ideas`, `GET /ideas/:id` (full briefing).

### Frontend (high level)

1. **Pitch card** component (anatomy in `project-plan.md` §8.5).
2. **Ideas list** with filters; **detail modal**; status workflow (accept / reject / defer).
3. **Aggregated ideas** panel on dashboard.

### Environment

```env
OPENAI_API_KEY=sk-...   # already required for embeddings; GPT calls in Phase 3
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
- `apps/web/src/components/sites/SiteTile.tsx`, `SiteFleet.tsx`, `SiteDetailDrawer.tsx`

---

## Key files to read before touching anything

| File | Why |
|---|---|
| `project-plan.md` | Full spec: data model, API design, queue params, prompts |
| `Sitebrief Design System/README.md` | Brand voice, palette, type, layout rules |
| `apps/api/src/crawler/crawl.processor.ts` | Crawl + enqueue parse |
| `apps/api/src/crawler/parse.processor.ts` | Parse/embed pipeline |
| `apps/api/src/crawler/html-parse.ts` | Extract + clean rules |
| `apps/api/src/crawler/page-classifier.ts` | Page type heuristics |
| `apps/api/prisma/schema.prisma` | Models + pgvector fields |
| `apps/web/src/api/client.ts` | Shared TypeScript types for API responses |
