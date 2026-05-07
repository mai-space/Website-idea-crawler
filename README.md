# Sitebrief (Website Idea Crawler)

Monorepo for the Sitebrief API (`apps/api`) and web dashboard (`apps/web`). The Vite dev server proxies `/api` and `/socket.io` to the NestJS API on port **3001**.

**All shell snippets below assume your current working directory is the repository root** (the folder that contains `package.json` and `apps/`).

```bash
git clone https://github.com/mai-space/Website-idea-crawler.git
cd Website-idea-crawler
```

## Prerequisites

- **Node.js** 18+ (20 LTS recommended)
- **npm** (workspaces are used at the repo root)
- **Docker** (recommended) for PostgreSQL with **pgvector** and **Redis** — or provide your own instances matching `DATABASE_URL` / Redis in `apps/api/.env`

## Quick start (one-line installer)

### One-line install + startup

```bash
curl -fsSL https://raw.githubusercontent.com/mai-space/Website-idea-crawler/main/install.sh | bash
```

This will:

- clone the repository into `~/sitebrief` (override with `SITEBRIEF_INSTALL_DIR`)
- install the npm workspaces
- create `apps/api/.env` from `.env.example` if needed
- generate a local `JWT_SECRET` automatically
- start PostgreSQL + Redis with Docker Compose
- generate the Prisma client, apply migrations, and start the API + web dashboard
- install a `sitebrief` wrapper in `~/.local/bin` (override with `SITEBRIEF_BIN_DIR`)

If a prerequisite is missing, the script stops and tells you what to install first.
If `OPENAI_API_KEY` is not configured, the app still starts, but embeddings and idea generation stay disabled until you add the key to `apps/api/.env`.

### Service commands

```bash
sitebrief start
sitebrief stop
sitebrief restart
sitebrief update
sitebrief status
```

If `~/.local/bin` is not on your `PATH`, run the script directly instead:

```bash
~/sitebrief/scripts/sitebrief.sh start
```

### Optional environment overrides

You can still override non-secret settings without editing the script first:

```bash
curl -fsSL https://raw.githubusercontent.com/mai-space/Website-idea-crawler/main/install.sh | SITEBRIEF_INSTALL_DIR=$HOME/sitebrief bash
```

For secrets like `OPENAI_API_KEY`, prefer downloading the script first and then adding the key to `~/sitebrief/apps/api/.env`.
Alternatively, export it in your shell before running the downloaded script instead of putting the secret directly into a curl-to-bash command.

## Manual setup (API + web)

### 1. Start Postgres and Redis

```bash
docker compose up -d
```

Wait until both services are healthy (first run may take a minute to pull images).

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the API environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` and set at least:

- `DATABASE_URL` — default in `.env.example` matches `docker-compose.yml`
- `JWT_SECRET` — use a long random string (32+ characters) in any real environment
- `OPENAI_API_KEY` — required for embeddings and idea generation features

### 4. Generate Prisma client and apply database migrations

```bash
npm run db:generate --workspace=apps/api
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Optional seed data:

```bash
npm run db:seed
```

### 5. Run API and web together

```bash
npm run dev
```

Open the app:

- **Dashboard / frontend:** [http://localhost:5173](http://localhost:5173)
- **API (direct):** [http://localhost:3001](http://localhost:3001) — usually not needed locally; Vite proxies `/api` to the API

Stop Node processes with `Ctrl+C`. Stop Docker services:

```bash
docker compose down
```

## Frontend only

Use this when you only want the Vite dev server. Login, REST calls, and WebSockets require the API (and database) to be running on **3001** with the proxy unchanged.

```bash
npm install
npm run dev --workspace=apps/web
```

Or equivalently:

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Useful commands

| Command | Description |
|--------|-------------|
| `npm run dev` | API (`nest start --watch`) + web (`vite`) concurrently |
| `npm run db:migrate` | Prisma migrate (from `apps/api`) |
| `npm run db:push` | Prisma `db push` (schema sync without migration files) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed script |

## Production builds

```bash
npm install
npm run build --workspace=apps/api
npm run build --workspace=apps/web
```

## Troubleshooting

- **401 / redirect to `/login`:** Sign in again; the web app stores the JWT in `localStorage` under `sb_token`.
- **Network errors on `/api`:** Ensure the API is listening on **3001** (`PORT` in `apps/api/.env`). The Vite proxy in `apps/web/vite.config.ts` targets `http://localhost:3001`.
- **WebSocket issues:** Socket.IO is proxied at `/socket.io`; use the same origin as the Vite app (**5173**).
- **Port already in use:** Change `PORT` for the API or `server.port` in `apps/web/vite.config.ts`, and update the proxy `target` if you change the API port.

## Repository layout

| Path | Role |
|------|------|
| `apps/api` | NestJS API, Prisma, BullMQ crawlers |
| `apps/web` | React + Vite dashboard |
| `docker-compose.yml` | Local Postgres (pgvector) + Redis |
| `.env.example` | Environment template (copy to `apps/api/.env`) |
