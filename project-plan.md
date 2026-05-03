# Multi-Site Intelligence System — Projektplan

> **Ziel:** Ein System, das N Websites parallel crawlt, Inhalte versteht, und pro Site entscheidungsreife Ideen als Pitch-Briefings für eingeloggte Nutzer generiert — inkl. Aufwandsschätzung und technischer Komplexitätsbewertung.

---

## Inhaltsverzeichnis

1. [Systemübersicht](#1-systemübersicht)
2. [Technologie-Stack](#2-technologie-stack)
3. [Architektur](#3-architektur)
4. [Datenmodell](#4-datenmodell)
5. [API-Design](#5-api-design)
6. [Queue-System](#6-queue-system)
7. [AI & Ideen-Engine](#7-ai--ideen-engine)
8. [Frontend-Anforderungen](#8-frontend-anforderungen)
9. [Umsetzungsplan (Phasen)](#9-umsetzungsplan-phasen)
10. [Risiken & Mitigationen](#10-risiken--mitigationen)

---

## 1. Systemübersicht

### Kernfunktionen

| Funktion | Beschreibung |
|---|---|
| **Multi-Site Crawling** | N Websites parallel, rate-limited pro Domain |
| **Content-Parsing** | Strukturierte Extraktion, Bereinigung, Klassifikation |
| **Embedding & Kontext** | Seitenweise Embeddings, site-isolierter Kontext-Store |
| **Ideen-Generierung** | AI-basiert, kontextbewusst, mit Duplikat-Erkennung |
| **Komplexitäts-Scoring** | Hybrides Modell: Regelbasiert + AI-Verfeinerung |
| **Pitch-Briefing** | Jede Idee als entscheidungsreifes Briefing für Nutzer |
| **Realtime Dashboard** | WebSocket-basiert, kein Polling |

### Systemgrenzen

```
[Browser / Client]
      ↓ HTTPS + WebSocket
[API Layer — NestJS]
      ↓
[Job Queue — Bull + Redis]
      ↓
[Worker Pool]
   ├── Crawler Worker
   ├── Parser Worker
   └── Ideas Worker
      ↓
[Storage]
   ├── PostgreSQL + pgvector
   └── Redis (Queue + Cache)
```

---

## 2. Technologie-Stack

### Backend

| Bereich | Technologie | Begründung |
|---|---|---|
| Runtime | Node.js 20 LTS | Stark für I/O-intensives Crawling |
| Framework | NestJS + TypeScript | Struktur, DI, Testbarkeit |
| Queue | Bull + Redis | Battle-tested, Prioritäten, Retry, DLQ |
| ORM | Prisma | Type-safe, Migrations, pgvector-Support |
| WebSocket | Socket.io | Reconnect, Rooms, Namespaces |
| Crawler | axios + cheerio | Leichtgewichtig; Puppeteer optional für JS-Sites |
| AI | OpenAI API (GPT-4o) | Ideen, Scoring, Summarization |
| Embeddings | text-embedding-3-small | Kosteneffizient, 1536 Dimensionen |

### Datenbank

| System | Zweck |
|---|---|
| PostgreSQL 16 | Primärdaten: Sites, Pages, Ideas, Jobs |
| pgvector Extension | Embeddings + Cosine-Similarity für Dedup |
| Redis 7 | Queue-Backend + Session-Cache |

### Frontend

| Bereich | Technologie |
|---|---|
| Framework | React 18 + TypeScript |
| State (Global) | Zustand / Jotai |
| State (Server) | TanStack Query (React Query) |
| Routing | React Router v6 |
| Virtualisierung | TanStack Virtual |
| WebSocket | socket.io-client |
| Styling | CSS Modules oder Tailwind |

---

## 3. Architektur

### Datenfluss: Single Request

```
Client
  → POST /api/v1/projects/:id/crawl
  → API validiert + erstellt crawl_job
  → Job in crawl-queue
  → Crawler Worker: fetcht URLs, speichert HTML
  → Jobs in parse-queue
  → Parser Worker: extrahiert, embeddet, klassifiziert
  → Jobs in ideas-queue
  → Ideas Worker: generiert, bewertet, dedupliziert
  → Ideen in PostgreSQL
  → WebSocket Push → Client
```

### Multi-Site Koordination

Der **Orchestrator** ist verantwortlich für:

- **Prioritäts-Scheduling:** Sites mit Priorität 1–10; höhere Sites bekommen mehr Worker-Slots
- **Domain Rate-Limiting:** Max. 2 req/s pro Domain, unabhängig von der Anzahl laufender Jobs
- **Worker-Budget:** `maxConcurrentCrawls` pro Organisation verhindert gegenseitige Blockierung
- **OpenAI TPM-Budget:** Token-Bucket pro Organisation; ideas-queue wird gedrosselt wenn Limit erreicht

### WebSocket Events

| Event | Richtung | Payload |
|---|---|---|
| `job.update` | Server → Client | `{ jobId, status, progress }` |
| `idea.created` | Server → Client | `{ ideaId, siteId, title, complexity }` |
| `crawl.page` | Server → Client | `{ siteId, url, pageType }` |
| `error.new` | Server → Client | `{ siteId, type, message, retryable }` |
| `queue.stats` | Server → Client | `{ crawl, parse, ideas, workers }` |

---

## 4. Datenmodell

### Entity-Relation-Übersicht

```
organizations ──< sites ──< crawl_jobs ──< pages
                        ↘               ↗
                          ideas >──< pages (via idea_sources)
```

### Tabellen

#### `organizations`
```sql
id            UUID PRIMARY KEY
name          VARCHAR(255)
plan          ENUM('free', 'pro', 'enterprise')
max_sites     INT DEFAULT 3
max_concurrent_crawls INT DEFAULT 2
created_at    TIMESTAMPTZ DEFAULT NOW()
```

#### `sites`
```sql
id            UUID PRIMARY KEY
org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE
name          VARCHAR(255)
url           VARCHAR(2048)
cms           ENUM('typo3', 'wordpress', 'generic')
priority      INT DEFAULT 5  -- 1 (niedrig) bis 10 (hoch)
status        ENUM('idle', 'crawling', 'analyzing', 'error')
health_score  FLOAT          -- 0.0–1.0
config        JSONB          -- crawler config
created_at    TIMESTAMPTZ
updated_at    TIMESTAMPTZ
```

#### `crawl_jobs`
```sql
id            UUID PRIMARY KEY
site_id       UUID REFERENCES sites(id) ON DELETE CASCADE
status        ENUM('queued', 'running', 'done', 'failed', 'stopped')
triggered_by  ENUM('manual', 'scheduled', 'api')
pages_total   INT
pages_crawled INT
started_at    TIMESTAMPTZ
finished_at   TIMESTAMPTZ
errors        JSONB[]
```

#### `pages`
```sql
id            UUID PRIMARY KEY
site_id       UUID REFERENCES sites(id) ON DELETE CASCADE
crawl_job_id  UUID REFERENCES crawl_jobs(id)
url           VARCHAR(2048)
type          ENUM('landing', 'blog', 'product', 'docs', 'other')
title         VARCHAR(512)
content_hash  VARCHAR(64)    -- SHA256, für Change Detection
embedding     VECTOR(1536)   -- pgvector
parsed_at     TIMESTAMPTZ
meta          JSONB          -- title, description, h1, word_count, …
```

#### `ideas`
```sql
id                  UUID PRIMARY KEY
site_id             UUID REFERENCES sites(id) ON DELETE CASCADE
title               VARCHAR(512)
pitch_text          TEXT           -- 2–3 Satz Pitch für Nutzer
description         TEXT           -- technische Details
complexity          ENUM('low', 'medium', 'high')
estimated_hours     INT
requires_dev        BOOLEAN
areas               VARCHAR[]      -- ['content', 'seo', 'feature', 'ux']
confidence          FLOAT          -- 0.0–1.0
impact_score        FLOAT          -- 0.0–1.0
status              ENUM('open', 'accepted', 'rejected', 'deferred', 'done')
custom_hours        INT            -- manuell überschrieben
rejected_reason     TEXT
notes               TEXT           -- Markdown
source_page_ids     UUID[]
embedding           VECTOR(1536)   -- für Dedup via Cosine Similarity
generated_at        TIMESTAMPTZ
updated_at          TIMESTAMPTZ
updated_by          UUID           -- FK users (Audit)
```

#### `idea_sources` (Junction)
```sql
idea_id   UUID REFERENCES ideas(id) ON DELETE CASCADE
page_id   UUID REFERENCES pages(id) ON DELETE CASCADE
PRIMARY KEY (idea_id, page_id)
```

### Empfohlene Indizes

```sql
CREATE INDEX ON pages USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON ideas USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON ideas (site_id, status, complexity);
CREATE INDEX ON pages (site_id, type);
CREATE INDEX ON crawl_jobs (site_id, status);
```

> **HNSW-Index** (Hierarchical Navigable Small World) ist für Nearest-Neighbor-Suche bei 1536-dim Embeddings deutlich schneller als IVFFlat bei niedrigen Recall-Anforderungen.

---

## 5. API-Design

### Base URL: `/api/v1`

### Authentifizierung

Alle Endpoints erfordern:
```
Authorization: Bearer <jwt_token>
```

JWT enthält: `userId`, `orgId`, `role` (admin | editor | viewer)

---

### Projects / Sites

| Method | Path | Beschreibung | Status |
|---|---|---|---|
| `POST` | `/sites` | Neue Site anlegen | 201 |
| `GET` | `/sites` | Alle Sites der Org | 200 |
| `GET` | `/sites/:id` | Site-Details + Stats | 200 |
| `PATCH` | `/sites/:id` | Config, Name, Priorität | 200 |
| `DELETE` | `/sites/:id` | Site + CASCADE | 204 |

### Crawler

| Method | Path | Beschreibung | Status |
|---|---|---|---|
| `POST` | `/sites/:id/crawl` | Crawl-Job starten | 202 async |
| `DELETE` | `/sites/:id/crawl` | Laufenden Crawl stoppen | 200 |
| `GET` | `/sites/:id/crawl/status` | Job-Status + Fortschritt | 200 |
| `GET` | `/sites/:id/pages` | Gecrawlte Seiten | 200 |

**POST `/sites/:id/crawl` — Request Body:**
```json
{
  "depth": 3,
  "sitemapUrl": "https://example.com/sitemap.xml",
  "respectRobots": true,
  "usePuppeteer": false
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "queued",
  "estimatedDuration": 120
}
```

### Ideas

| Method | Path | Beschreibung | Status |
|---|---|---|---|
| `POST` | `/sites/:id/ideas/generate` | Ideen-Job starten | 202 async |
| `GET` | `/sites/:id/ideas` | Ideen (gefiltert, sortiert) | 200 |
| `GET` | `/ideas` | Alle Ideen org-weit (aggregiert) | 200 |
| `GET` | `/ideas/:id` | Idee im Detail (Pitch + Technik) | 200 |
| `PATCH` | `/ideas/:id` | Status, Notizen, custom Hours | 200 |

**GET `/ideas` — Query Params:**
```
complexity=low|medium|high
requires_dev=true|false
area=content|seo|feature|ux
status=open|accepted|rejected|deferred|done
sort=impact|effort|created_at
site_id=uuid
page=1
limit=20
```

**GET `/ideas/:id` — Response (Pitch-Briefing Format):**
```json
{
  "id": "uuid",
  "title": "Blogserie zu Feature X einführen",
  "pitchText": "Die Site hat starken Traffic auf Produkt-Seiten, aber keinen begleitenden Content. Eine Blogserie könnte organische Reichweite und Conversion steigern.",
  "complexity": "medium",
  "estimatedHours": 16,
  "requiresDev": false,
  "areas": ["content", "seo"],
  "confidence": 0.84,
  "impactScore": 0.76,
  "status": "open",
  "cmsHint": "In TYPO3 über die News-Extension umsetzbar — kein Custom Dev nötig.",
  "reasoning": "Regelbasiert: type=blog → low base. AI-Refinement: hoher Content-Gap erkannt → medium.",
  "sourcePages": [
    { "id": "uuid", "url": "/produkte/feature-x", "type": "product" }
  ],
  "notes": null,
  "generatedAt": "2026-05-03T10:00:00Z"
}
```

### Export

| Method | Path | Beschreibung | Status |
|---|---|---|---|
| `GET` | `/sites/:id/export` | Site-Export | 200 File |
| `GET` | `/export` | Org-weiter Export | 200 File |

**Query Params:** `format=json|csv|pdf`, `status=open|accepted`, `complexity=low|medium|high`

### Scoring (Standalone)

| Method | Path | Beschreibung | Status |
|---|---|---|---|
| `POST` | `/scoring/evaluate` | Idee bewerten ohne Projekt | 200 |

---

## 6. Queue-System

### Übersicht

```
crawl-queue  →  parse-queue  →  ideas-queue
(2–5 workers)   (3–8 workers)   (1–3 workers)
```

Jede Queue ist **vollständig isoliert** — kein Worker-Typ blockiert den anderen.

---

### crawl-queue

**Zweck:** URLs fetchen, HTML speichern, Links extrahieren

| Parameter | Wert |
|---|---|
| Concurrency | 3 (konfigurierbar) |
| Rate Limit | 2 req/s pro Domain |
| Retry | 3x, exponential backoff (1s / 4s / 16s) |
| Timeout | 10s pro Request |
| DLQ | `crawl-failed` nach 3 Failures |

**Job Types:**

- `crawl:robots` — robots.txt parsen, Disallow-Regeln cachen (≈200ms)
- `crawl:sitemap` — Sitemap parsen, URLs in Queue einreihen (≈500ms)
- `crawl:page` — Einzelne URL fetchen, HTML in DB/S3 speichern (1–5s)

**Prioritäts-Logik:**

```
Job-Priorität = Site.priority × 10 + (isSitemap ? 5 : 0)
```

---

### parse-queue

**Zweck:** HTML zu strukturierten Daten verarbeiten, Embeddings erstellen

| Parameter | Wert |
|---|---|
| Concurrency | 5 |
| Rate Limit | intern, kein externes Limit |
| Retry | 2x |
| DLQ | `parse-failed`; Raw-HTML bleibt erhalten |

**Job Types:**

- `parse:extract` — HTML → title, body, meta, links (≈200ms)
- `parse:clean` — Nav/Footer/Ads entfernen, Sprache erkennen (≈100ms)
- `parse:classify` — Seitentyp erkennen: landing / blog / product / docs (≈150ms)
- `parse:embed` — Text → OpenAI Embedding → in pgvector speichern (300–800ms)

**Cleaning-Regeln (Nav/Footer-Filter):**

```
entfernen: <nav>, <header>, <footer>, <aside>
entfernen: class enthält "menu", "sidebar", "cookie", "banner"
behalten:  <main>, <article>, [role="main"]
```

---

### ideas-queue

**Zweck:** Ideen generieren, bewerten, deduplizieren

| Parameter | Wert |
|---|---|
| Concurrency | 2 |
| Rate Limit | OpenAI TPM-Budget (Token-Bucket pro Org) |
| Retry | 2x (AI Timeout) |
| DLQ | `ideas-failed`; Site bleibt analysiert, retry planbar |

**Job Types:**

- `ideas:generate` — Kontext-Bundle → GPT-4o → Ideen-Array (3–15s)
- `ideas:score` — Regel-Engine + AI-Refinement → Complexity Score (1–4s)
- `ideas:dedup` — Cosine Similarity gegen bestehende Ideen (Schwelle: 0.92) (≈300ms)
- `ideas:rank` — Impact/Effort-Matrix berechnen, Priorität setzen (≈100ms)

**Kontext-Bundle pro Site:**

```json
{
  "siteUrl": "https://example.com",
  "cms": "typo3",
  "extensions": ["news", "solr"],
  "pages": [
    {
      "url": "/blog",
      "type": "blog",
      "title": "Blog Übersicht",
      "wordCount": 320,
      "topicSummary": "Produktneuheiten und Branchen-News"
    }
  ],
  "contentGaps": ["kein FAQ", "keine Case Studies"],
  "existingIdeasSummary": "15 Ideen, davon 3 accepted"
}
```

---

### Dead Letter Queue (DLQ) Handling

| Queue | DLQ Name | Strategie |
|---|---|---|
| crawl-queue | `crawl-failed` | Manuelles Review oder Auto-Skip nach 3 Fails |
| parse-queue | `parse-failed` | Seite als `parse-error` markiert, Raw-HTML bleibt |
| ideas-queue | `ideas-failed` | Retry planbar, Site-Status unberührt |

---

## 7. AI & Ideen-Engine

### Komplexitäts-Scoring — Hybrides Modell

**Stufe 1: Regelbasiert (schnell, deterministisch)**

```typescript
function baseScore(idea: Idea, cms: CmsType): BaseScore {
  // Typ-basiert
  if (idea.type === 'blog_post')     return { complexity: 'low',    hours: 4  };
  if (idea.type === 'seo_fix')       return { complexity: 'low',    hours: 8  };
  if (idea.type === 'new_section')   return { complexity: 'medium', hours: 16 };
  if (idea.type === 'api_integration') return { complexity: 'high', hours: 40 };

  // CMS-aware für TYPO3
  if (cms === 'typo3') {
    if (idea.usesExistingExtension)  return { complexity: 'low',  hours: 6  };
    if (idea.requiresNewExtension)   return { complexity: 'high', hours: 60 };
  }
}
```

**Stufe 2: AI-Verfeinerung (kontextbewusst)**

```
System: Du bist ein TYPO3-Entwickler mit 10 Jahren Erfahrung.
        Bewerte die technische Komplexität der folgenden Idee.
        Antworte ausschließlich als JSON.

User:   Idee: {title}
        Kontext: {siteContext}
        Installierte Extensions: {extensions}
        Basis-Score: {baseScore}

        Gib zurück:
        { complexity, estimatedHours, requiresDev, areas, confidence, reasoning }
```

**Stufe 3: CMS-Aware Override-Tabelle**

| Idee | TYPO3 | WordPress | Generic |
|---|---|---|---|
| Neue Seite anlegen | 🟢 low / 1h | 🟢 low / 1h | 🟢 low / 2h |
| News-Sektion | 🟢 low / 4h (EXT:news) | 🟢 low / 4h | 🟡 medium / 16h |
| Eigenes Plugin | 🔴 high / 60h | 🟡 medium / 30h | 🔴 high / 80h |
| API-Integration | 🔴 high / 40h | 🔴 high / 40h | 🔴 high / 50h |
| SEO-Metadaten | 🟢 low / 2h | 🟢 low / 2h | 🟡 medium / 8h |

### Pitch-Briefing Prompt

```
Du generierst Ideen für eine Website. Jede Idee MUSS entscheidungsreif sein.

Format pro Idee:
{
  "title": "Aktionsorientierter Titel (max 8 Wörter)",
  "pitchText": "2–3 Sätze: Was, Warum, Welcher Nutzen. Kein Fachjargon.",
  "cmsHint": "CMS-spezifischer Umsetzungshinweis (optional)",
  "type": "blog|feature|seo_fix|new_section|api_integration|other",
  "areas": ["content"|"seo"|"feature"|"ux"]
}

Regeln:
- pitchText ist für nicht-technische Entscheider geschrieben
- Keine Markdown-Formatierung im pitchText
- Maximal 20 Ideen pro Aufruf
- Keine Duplikate zu: {existingIdeasSummary}
```

### Deduplication

Cosine-Similarity zwischen neuer Idee und allen bestehenden Ideen der Site:

```typescript
const DEDUP_THRESHOLD = 0.92;

async function isDuplicate(newEmbedding: number[], siteId: string): Promise<boolean> {
  const result = await db.$queryRaw`
    SELECT 1 FROM ideas
    WHERE site_id = ${siteId}
    AND 1 - (embedding <=> ${newEmbedding}::vector) > ${DEDUP_THRESHOLD}
    LIMIT 1
  `;
  return result.length > 0;
}
```

---

## 8. Frontend-Anforderungen

### Prioritäten-Legende

- **MUST** — MVP, ohne das kein Launch
- **SHOULD** — V1, stark empfohlen
- **COULD** — spätere Iteration

---

### 8.1 Authentifizierung & Nutzerkontext

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| A1 | MUST | Login / Logout via JWT, 7-Tage-Session |
| A2 | MUST | User-Name, Org, Avatar-Initialen in Navbar |
| A3 | SHOULD | Rollen: Admin / Editor / Viewer (UI-Sichtbarkeit) |
| A4 | COULD | Einladungs-Flow per E-Mail |

### 8.2 Navigation & Layout

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| N1 | MUST | Fixe Sidebar (240px), collapsible auf 56px |
| N2 | MUST | Globaler Header: Logo, Breadcrumb, User-Menu |
| N3 | MUST | Responsive: Desktop / Tablet / Mobile Breakpoints |
| N4 | SHOULD | Keyboard Navigation + Command Palette (⌘K) |

### 8.3 Dashboard & Site Fleet

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| D1 | MUST | Site Fleet Grid: Status, Ideen-Count, letzter Crawl |
| D2 | MUST | Realtime via WebSocket (kein Polling) |
| D3 | MUST | Queue Monitor Widget: 3 Queues + Worker-Auslastung |
| D4 | SHOULD | Activity Stream (virtualisiert, Filter by Site) |
| D5 | SHOULD | Aggregiertes Ideen-Panel: Top-Ideen über alle Sites |
| D6 | COULD | Error Console mit Re-Queue Button |

### 8.4 Site Detail & Crawl-Steuerung

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| S1 | MUST | Site Detail Drawer: Slide-in, 480px, Tabs |
| S2 | MUST | Crawl starten / stoppen mit Fortschrittsbalken |
| S3 | MUST | Seiten-Baum nach URL-Tiefe, Seitentyp-Icons |
| S4 | SHOULD | Inline Crawl-Konfiguration (Tiefe, Rate, Puppeteer) |
| S5 | SHOULD | Crawl-Verlauf: letzte 10 Jobs als Timeline |
| S6 | COULD | Crawl-Scheduling (Cron-Picker) |

### 8.5 Ideen als Pitch-Briefing *(Kernfeature)*

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| I1 | MUST | **Pitch-Card Format:** Titel, Pitch-Text, Aufwand-Badge, Impact, Areas, CMS-Hint |
| I2 | MUST | Ideen-Liste mit Filtern (Site, Complexity, Area, Status) |
| I3 | MUST | Ideen-Detail Modal: Pitch + technische Details + Quell-Seiten |
| I4 | MUST | Status-Workflow: Open → Accepted / Rejected / Deferred |
| I5 | SHOULD | Ideen-Board (Kanban-Toggle, Drag-to-move, Bulk-Actions) |
| I6 | SHOULD | Manuelle Stunden-Korrektur (visuell als "manuell" markiert) |
| I7 | SHOULD | Notizen pro Idee (Markdown, mit Audit-Trail) |
| I8 | COULD | "Ideen generieren" Trigger mit Live-Einfügung via WebSocket |

**Pitch-Card Anatomie:**

```
┌─────────────────────────────────────────────┐
│ [MEDIUM]  [CONTENT] [SEO]           🕐 16h  │
│                                             │
│ Blogserie zu Feature X einführen            │  ← Titel
│                                             │
│ Die Site hat starken Traffic auf Produkt-   │  ← Pitch-Text
│ Seiten, aber keinen begleitenden Content.   │  (2–3 Sätze, kein Jargon)
│ Eine Blogserie könnte organische Reichweite │
│ und Conversion steigern.                   │
│                                             │
│ 💡 TYPO3: Über EXT:news umsetzbar.          │  ← CMS-Hint
│                                             │
│ [Accept]  [Reject]  [Defer]   Impact: ████░ │
└─────────────────────────────────────────────┘
```

### 8.6 Export & Sharing

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| E1 | SHOULD | Export-Dialog: Format, Scope, Filter, Preview-Count |
| E2 | SHOULD | PDF-Export im Pitch-Briefing Format (kein JSON-Dump) |
| E3 | COULD | Shareable Read-Only Link (ablaufbar) |
| E4 | COULD | Jira / Trello Export für accepted Ideas |

### 8.7 UX-Qualität

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| U1 | MUST | Skeleton Screens statt leerer Flächen |
| U2 | MUST | Toast Notifications (Erfolg / Fehler / Info) |
| U3 | MUST | Bestätigungs-Dialog vor destruktiven Aktionen |
| U4 | MUST | Empty States mit primärer Handlungsaufforderung |
| U5 | SHOULD | Optimistic UI Updates mit Rollback bei Fehler |
| U6 | SHOULD | 404 und 500 Fehlerseiten |

### 8.8 Technische Frontend-Anforderungen

| ID | MUST/SHOULD | Anforderung |
|---|---|---|
| T1 | MUST | React + TypeScript, keine `any`-Typen |
| T2 | MUST | Zustand/Jotai (global) + TanStack Query (server state) |
| T3 | MUST | WebSocket mit Auto-Reconnect + Connection-Status in UI |
| T4 | MUST | React Router v6, Protected Routes |
| T5 | SHOULD | TanStack Virtual für Listen >100 Einträge |
| T6 | SHOULD | WCAG 2.1 AA Accessibility |

---

## 9. Umsetzungsplan (Phasen)

### Zeitleiste

```
Phase 1 ──── Phase 2 ──── Phase 3 ──── Phase 4 ──── Phase 5
  W1–3         W4–6         W7–10        W11–13       W14–15
```

---

### Phase 1 — Multi-Site Foundation *(Wochen 1–3)*

**Ziel:** Mehrere Sites verwalten, erste Crawls starten, Basis-Dashboard

**Backend:**
- Organization + Sites Datenmodell (PostgreSQL + Prisma)
- Bull + Redis Setup, `crawl-queue` mit 3 Workers
- Rate-Limiter (2 req/s pro Domain) mit Redis Token-Bucket
- `POST /sites/:id/crawl` → async Job → WebSocket Job-Updates
- Basis-Auth: JWT Login / Logout

**Frontend:**
- Login-Seite + Protected Routes
- Sidebar Navigation + Header
- Site Fleet Grid (Status, letzter Crawl)
- Crawl starten / stoppen mit Fortschrittsbalken
- WebSocket-Verbindung + Queue Monitor Widget (Basis)

**Liefert:** Funktionierender Multi-Site Crawler mit Echtzeit-Status

---

### Phase 2 — Parse & Embed Pipeline *(Wochen 4–6)*

**Ziel:** Strukturierter Content, Embeddings, Seitenbaum

**Backend:**
- `parse-queue` mit 5 Workers
- HTML-Cleaner (Nav/Footer-Filter nach Regel-Set)
- Seitentyp-Klassifikation (regelbasiert)
- OpenAI Embeddings → pgvector (HNSW Index)
- `GET /sites/:id/pages` mit Typ-Filter

**Frontend:**
- Site Detail Drawer mit Seiten-Baum
- Seitentyp-Icons (landing, blog, product, docs)
- Activity Stream (Basis, ohne Virtualisierung)
- Crawl-Verlauf Timeline

**Liefert:** Gecrawlte Seiten sind strukturiert, klassifiziert und embeddable

---

### Phase 3 — Ideas Engine v2 *(Wochen 7–10)*

**Ziel:** Kontextbewusste Ideengenerierung, Scoring, Deduplication

**Backend:**
- `ideas-queue` mit 2 Workers
- Kontext-Bundle Builder pro Site
- GPT-4o Ideen-Generierung mit Pitch-Briefing Prompt
- Regelbasiertes Komplexitäts-Scoring + AI-Verfeinerung
- CMS-aware Scoring-Tabelle (TYPO3, WordPress, Generic)
- Cosine-Similarity Deduplication (Schwelle 0.92)
- `GET /ideas/:id` liefert vollständiges Pitch-Briefing

**Frontend:**
- Pitch-Card Komponente (vollständige Anatomie)
- Ideen-Liste mit allen Filtern
- Ideen-Detail Modal
- Status-Workflow (Accept / Reject / Defer)
- Ideen-Panel im Dashboard (aggregiert)

**Liefert:** Entscheidungsreife Pitch-Briefings pro Idee

---

### Phase 4 — Dashboard v2 + Realtime *(Wochen 11–13)*

**Ziel:** Vollständiges Dashboard, alle UX-Anforderungen

**Backend:**
- WebSocket Events vollständig (alle 5 Event-Types)
- `GET /ideas` org-weit mit Aggregation
- Export-Endpoint: JSON / CSV / PDF

**Frontend:**
- Activity Stream (TanStack Virtual, Filter, Auto-Scroll)
- Error Console mit Re-Queue Button
- Ideen-Board (Kanban, Drag-to-move, Bulk-Actions)
- Manuelle Stunden-Korrektur
- Export-Dialog (Format, Scope, Filter)
- PDF-Export im Pitch-Format
- Alle UX-Anforderungen: Skeleton Screens, Toasts, Empty States

**Liefert:** Produktionsreifes Dashboard für mehrere Nutzer

---

### Phase 5 — Scheduling & Automation *(Wochen 14–15)*

**Ziel:** Automatische Crawls, Change Detection, Notifications

**Backend:**
- Cron-basierter Scheduler (pro Site konfigurierbar)
- Content-Hash Change Detection — nur geänderte Seiten re-analysieren
- E-Mail / Slack Webhook bei neuen Ideen (konfigurierbar)

**Frontend:**
- Crawl-Scheduler UI (Cron-Picker, nächster Run)
- Command Palette (⌘K)
- Keyboard Navigation

**Liefert:** Vollautomatischer Betrieb ohne manuelle Crawl-Trigger

---

### Meilensteine

| Meilenstein | Ende Woche | Kriterium |
|---|---|---|
| M1: Erster Crawl | W3 | 2 Sites crawlen parallel, Status live im Dashboard |
| M2: Erste Ideen | W10 | Pitch-Briefings für gecrawlte Sites, Scoring korrekt |
| M3: Multi-User | W13 | 3 Nutzer gleichzeitig, Rollen korrekt, Export funktioniert |
| M4: Vollautomatisch | W15 | Crawls laufen ohne manuellen Trigger, Notifications korrekt |

---

## 10. Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| **OpenAI Rate Limits** bei vielen Sites | Hoch | Hoch | Token-Bucket pro Org; ideas-queue drosseln; Batch-Requests |
| **Queue-Stau** bei sehr großen Sites | Mittel | Mittel | Max-Pages-Cap (default: 500) pro Crawl-Job; Depth-Limit |
| **DB-Größe** durch Embeddings (1536 dim) | Mittel | Mittel | HNSW-Index; ältere Embeddings archivieren; pg_partman |
| **Cross-Site Datenvermischung** | Niedrig | Hoch | `site_id` in allen Queries; Row-Level Security in PostgreSQL |
| **JS-heavy Sites** nicht crawlbar | Mittel | Mittel | Puppeteer als opt-in; Fallback auf statisches Crawling |
| **Ideenqualität** zu generisch | Mittel | Hoch | Prompt-Tuning; Regel-Override; manuelles Feedback-Loop |
| **Kontext zu groß** für GPT-4o | Mittel | Mittel | Seiten-Zusammenfassungen statt Volltext; max. 50 Seiten pro Bundle |

---

## Anhang: Konfigurationsreferenz

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/analyzer

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_TPM_BUDGET=100000        # Token per Minute pro Org

# Crawler
CRAWLER_DEFAULT_DEPTH=3
CRAWLER_MAX_PAGES=500
CRAWLER_RATE_LIMIT_RPS=2        # Requests per Second pro Domain
CRAWLER_TIMEOUT_MS=10000

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# App
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### Similarity-Schwellen

```typescript
const CONFIG = {
  DEDUP_THRESHOLD: 0.92,        // Ideen-Deduplizierung
  MIN_CONFIDENCE: 0.60,         // Ideen unter 0.60 werden verworfen
  MAX_IDEAS_PER_SITE: 50,       // Pro Crawl-Job
  MAX_PAGES_PER_BUNDLE: 50,     // Kontext-Bundle für AI
  HNSW_EF_CONSTRUCTION: 64,     // pgvector Index-Qualität
};
```

---

*Erstellt: Mai 2026 — Version 2.0*
