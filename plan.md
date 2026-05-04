# Sitebrief — Agent Handover

> Last updated: 2026-05-04  
> Completed through: **Phase 5 — Scheduling & Automation** (with Phase 4 dashboard scope)

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
│   │   │   ├── schema.prisma All tables + enums + pgvector on Page/Idea; Idea.cmsHint
│   │   │   ├── migrations/   SQL: vector extension, HNSW, phase2 pages, phase3 cms_hint
│   │   │   └── seed.ts       Demo org + admin user + 2 sites
│   │   └── src/
│   │       ├── auth/         JWT login/register/me
│   │       ├── sites/        Sites CRUD (org-scoped)
│   │       ├── crawler/      Queues, crawl/parse/ideas processors, scheduler, export wiring
│   │       ├── export/       Org-wide export controller
│   │       ├── dashboard/    Crawl error feed API
│   │       ├── notifications/ Webhook notifier for new ideas
│   │       ├── events/       Socket.io WebSocket gateway
│   │       └── prisma/       Global PrismaService
│   └── web/                  React 18 + Vite + TypeScript frontend
│       └── src/
│           ├── api/client.ts Axios instance + shared types
│           ├── store/        Zustand: auth + socket + activity + error log + toasts
│           ├── hooks/        useAuth, useSocket
│           ├── pages/        LoginPage, DashboardPage
│           └── components/
│               ├── layout/   Sidebar, Topbar, CommandPalette
│               ├── sites/    SiteFleet, SiteTile, SiteDetailDrawer, PageTypeIcon
│               ├── ideas/    PitchCard, IdeaDetailModal, IdeasPanel, IdeasKanbanBoard
│               ├── dashboard/ ActivityFeed (virtualized), ErrorConsole
│               ├── export/   ExportDialog (JSON/CSV + client PDF)
│               ├── ui/       Toaster
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
| Ideas LLM | OpenAI `gpt-4o` (JSON pitch briefings) |

---

## How to run locally

**Prerequisites:** Docker, Node.js 20, npm 10+

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Copy env (only needed on a fresh clone)
cp .env.example .env
# Set OPENAI_API_KEY for embeddings + idea generation (parse still runs without it; ideas need the key)

# 3. Apply schema, then migrations (HNSW + unique index on pages + idea cms_hint)
npm run db:push    # creates/updates tables from Prisma schema
npm run db:migrate # applies prisma/migrations/*

# 4. Seed demo data
npm run db:seed    # org + admin@sitebrief.dev / password123 + 2 sites

# 5. Start both apps
npm run dev
#   API  → http://localhost:3001/api/v1
#   Web  → http://localhost:5173
```

**Note:** If `prisma migrate` fails with access errors on `localhost:5432`, another Postgres may be bound to that port. Point `DATABASE_URL` at the Docker host/port you mapped (or change the compose port mapping).

---

## API reference (Phase 1–3 endpoints)

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
| GET | `/sites/:siteId/crawl/status` | Job status + queue stats (`crawl`, `parse`, `ideas`, `workers` = 10) |
| GET | `/sites/:siteId/pages` | Pages for a site; optional `?type=landing\|blog\|product\|docs\|other` — returns `parsedAt`, `type`, `meta` (no raw HTML or embedding vector) |
| POST | `/sites/:siteId/ideas/generate` | Queue ideas pipeline → `{ jobId, status: 'queued' }` (requires parsed pages + `OPENAI_API_KEY`; sets site `analyzing` until job finishes) |
| GET | `/sites/:siteId/ideas` | Paginated ideas: query `complexity`, `requires_dev`, `area`, `status`, `sort`, `page`, `limit` → `{ items, total, page, limit }` |
| GET | `/ideas` | Org-wide ideas; same query params + optional `site_id` (must belong to org) |
| GET | `/ideas/:id` | Full pitch briefing + `sourcePages`, `reasoning`, `cmsHint`, `displayHours` |
| PATCH | `/ideas/:id` | `{ status?, notes?, customHours? }` |
| GET | `/ideas/stats` | Org aggregates: `total`, `openHighImpact`, `byStatus`, `byComplexity` |
| POST | `/ideas/bulk` | `{ ids: uuid[], status }` — max 100 ideas, org-scoped |
| GET | `/export` | `?format=json\|csv` + optional `site_id`, `status`, `complexity`, `limit` |
| GET | `/sites/:siteId/export` | Same filters, scoped to one site |
| GET | `/dashboard/crawl-errors` | Recent crawl job error entries for the org |
| PATCH | `/sites/:id` | Adds `scheduleEnabled`, `scheduleCron` (cron-parser v5 / six-field; five-field accepted with `0` sec prefix server-side) |

---

## WebSocket events (Socket.io)

Connect with `query: { orgId }` — client is auto-joined to `org:<orgId>` room.  
Emit `subscribe:site` with a `siteId` string to join `site:<siteId>` (used by the site detail drawer).

| Event | Direction | Payload |
|---|---|---|
| `job.update` | Server → Client | `{ jobId, siteId, status, progress }` — also used for ideas Bull job id |
| `crawl.page` | Server → Client | `{ siteId, url, pageType }` — fired after crawl and again after parse completes (refined type) |
| `queue.stats` | Server → Client | `{ crawl, parse, ideas, workers }` |
| `error.new` | Server → Client | `{ siteId, type, message, retryable }` — includes `parse_error`, `ideas_error` |
| `idea.new` | Server → Client | `{ ideaId, siteId, title }` — to `org:<orgId>` and `site:<siteId>` |
| `idea.updated` | Server → Client | `{ ideaId, siteId, status?, customHours? }` — after `PATCH /ideas/:id` |

---

## Phase progress

| Phase | Weeks | Status | Notes |
|---|---|---|---|
| **1 — Multi-Site Foundation** | W1–3 | **Done** | Crawler, auth, sites CRUD, WebSocket, dashboard UI |
| **2 — Parse & Embed Pipeline** | W4–6 | **Done** | `parse-queue`, HTML extract/clean/classify, OpenAI embed, pgvector + HNSW, pages `?type=`, site drawer + activity + crawl timeline |
| **3 — Ideas Engine** | W7–10 | **Done** | `ideas-queue` (2 workers), GPT-4o JSON briefs, embed + dedup (0.92), REST + Briefs tab + `IdeasPanel` + `idea.new` |
| **4 — Dashboard v2 + Realtime** | W11–13 | **Done** | `GET /ideas/stats`, `POST /ideas/bulk`, exports, virtual activity, error console + re-crawl, Kanban (dnd-kit) + bulk, toasts, ⌘K palette, client PDF |
| **5 — Scheduling & Automation** | W14–15 | **Done** | `Site.schedule*`, `CrawlSchedulerService` (minute tick), content-hash skip re-parse, Slack/generic webhooks on new ideas |

---

## Phase 2 — implementation notes (for maintainers)

- **Queues:** `crawl-queue` (3 workers) + `parse-queue` (5 workers), both registered in `CrawlerModule`. After each successful page upsert, a Bull job named `parse:extract` runs the full **extract → clean → classify → embed** pipeline in one worker invocation (matches the four logical job types from the spec).
- **Pages:** Upsert is keyed by **`@@unique([siteId, url])`**; `rawHtml` is stored on crawl and cleared after a successful parse (embedding runs before clear so retries keep HTML if OpenAI fails).
- **pgvector:** `Page.embedding` and `Idea.embedding` use Prisma `Unsupported("vector(1536)")`; writes use raw SQL. Migration `20260504120000_phase2_parse_embed` adds extension, columns, unique index, and partial HNSW indexes.
- **Frontend:** `SiteDetailDrawer` (480px), `PageTypeIcon`, crawl activity ring buffer in Zustand, `subscribe:site` on open.

---

## Phase 3 — implementation notes (for maintainers)

- **Queues:** `ideas-queue` (2 workers), job name `ideas:pipeline` — context bundle → **GPT-4o** (`response_format: json_object`) → per-idea **embedding** + **dedup** (`1 - (embedding <=> candidate) > 0.92` vs existing site ideas) → Prisma `Idea` + `IdeaSource` rows. `MIN_CONFIDENCE` 0.6 drops weak items.
- **Site lock:** `IdeasService.enqueueGenerate` sets `Site.status` to `analyzing` until `IdeasProcessor` `finally` resets `idle` (also on early GPT/JSON failures).
- **Schema:** `Idea.cmsHint` (VARCHAR 1024); pitch reasoning stored in `Idea.description` for API field `reasoning`.
- **Frontend:** `PitchCard`, `IdeaDetailModal`, dashboard `IdeasPanel`, drawer **Briefs** tab with filters; socket `idea.new` invalidates TanStack Query.

---

## Phase 4–5 — implementation notes (for maintainers)

- **Exports:** `ExportModule` + `GET /export` and `GET /sites/:siteId/export` return JSON rows or `{ format: 'csv', content }`. PDF pitch packs are generated in the browser (`jspdf`) via `ExportDialog`.
- **Ideas UX:** `GET /ideas/stats`, `POST /ideas/bulk`, `idea.updated` socket, `IdeasKanbanBoard` (drag column = status), manual hours in `IdeaDetailModal`, `Toaster` + `useToastStore`.
- **Activity / errors:** `@tanstack/react-virtual` for the crawl activity list; `error.new` also pushes into Zustand `errorLog`; `GET /dashboard/crawl-errors` lists persisted job errors.
- **Scheduling:** `@nestjs/schedule` + `cron-parser` v5 (`CronExpressionParser`); `Site.scheduleEnabled`, `scheduleCron`, `nextCrawlAt`; `CrawlSchedulerService` runs scheduled crawls with `JobTrigger.scheduled`.
- **Change detection:** `crawl.processor` skips parse when `contentHash` unchanged and `parsedAt` is set; clears `embedding` when HTML changes.
- **Notifications:** `NotifierService` POSTs JSON to `SLACK_WEBHOOK_URL` and/or `NOTIFY_WEBHOOK_URL` when a new idea is stored.

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
| `apps/api/src/crawler/ideas.processor.ts` | Ideas pipeline (GPT + dedup) |
| `apps/api/src/crawler/ideas.service.ts` | Ideas REST + enqueue + stats + bulk |
| `apps/api/src/crawler/crawl-scheduler.service.ts` | Scheduled crawl tick |
| `apps/api/src/export/export.controller.ts` | Org export |
| `apps/api/src/dashboard/dashboard.controller.ts` | Crawl error feed |
| `apps/api/src/notifications/notifier.service.ts` | Slack / generic webhooks |
| `apps/api/src/crawler/html-parse.ts` | Extract + clean rules |
| `apps/api/src/crawler/page-classifier.ts` | Page type heuristics |
| `apps/api/prisma/schema.prisma` | Models + pgvector fields |
| `apps/web/src/api/client.ts` | Shared TypeScript types for API responses |
