import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import OpenAI from 'openai';
import type { CmsType, PageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { IDEAS_QUEUE, type GenerateIdeasJob } from './ideas.constants';
import { QueueStatsEmitter } from './queue-stats.emitter';
import { baseScore, normalizeIdeaKind } from './ideas.scoring';
import { NotifierService } from '../notifications/notifier.service';

const DEDUP_THRESHOLD = 0.92;
const MIN_CONFIDENCE = 0.6;
const MAX_IDEAS_PER_RUN = 15;
const MAX_PAGES_PER_BUNDLE = 50;

const VALID_AREAS = new Set(['content', 'seo', 'feature', 'ux']);

interface ContextPage {
  url: string;
  type: string;
  title: string;
  wordCount: number;
  topicSummary: string;
}

interface ContextBundle {
  siteUrl: string;
  cms: string;
  extensions: string[];
  pages: ContextPage[];
  contentGaps: string[];
  existingIdeasSummary: string;
}

interface RawIdea {
  title?: string;
  pitchText?: string;
  cmsHint?: string;
  type?: string;
  areas?: string[];
  complexity?: string;
  estimatedHours?: number;
  requiresDev?: boolean;
  confidence?: number;
  impactScore?: number;
  reasoning?: string;
  sourcePageUrls?: string[];
}

function normalizeUrlPath(full: string): string {
  try {
    const u = new URL(full);
    return u.pathname + u.search;
  } catch {
    return full;
  }
}

function buildContentGaps(pages: { type: PageType }[]): string[] {
  const types = new Set(pages.map((p) => p.type));
  const gaps: string[] = [];
  if (!types.has('blog')) gaps.push('No blog section detected');
  if (!types.has('docs')) gaps.push('No dedicated docs area detected');
  if (!types.has('product')) gaps.push('Few or no product detail pages');
  if (!types.has('landing')) gaps.push('No clear marketing landing pages');
  return gaps;
}

function clampAreas(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) return ['content'];
  const out = raw.map((a) => String(a).toLowerCase()).filter((a) => VALID_AREAS.has(a));
  return out.length ? out : ['content'];
}

@Processor(IDEAS_QUEUE, { concurrency: 2 })
export class IdeasProcessor extends WorkerHost {
  private readonly logger = new Logger(IdeasProcessor.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly queueStats: QueueStatsEmitter,
    private readonly notifier: NotifierService,
  ) {
    super();
  }

  private getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  async process(job: Job<GenerateIdeasJob>) {
    const { orgId, siteId } = job.data;

    try {
      const client = this.getOpenAI();
      if (!client) {
        this.logger.warn('OPENAI_API_KEY missing — ideas job skipped');
        return;
      }

      this.events.emitJobUpdate(orgId, {
        jobId: String(job.id),
        siteId,
        status: 'running',
        progress: 5,
      });
      const site = await this.prisma.site.findUnique({
        where: { id: siteId },
        include: {
          pages: {
            where: { parsedAt: { not: null } },
            orderBy: [{ parsedAt: 'desc' }],
            take: MAX_PAGES_PER_BUNDLE,
          },
        },
      });
      if (!site) return;

      const statusCounts = await this.prisma.idea.groupBy({
        by: ['status'],
        where: { siteId },
        _count: { _all: true },
      });
      const parts = statusCounts.map((r) => `${r._count._all} ${r.status}`);
      const existingIdeasSummary = parts.length ? parts.join(', ') : 'none yet';

      const pages: ContextPage[] = site.pages.map((p) => {
        const meta = (p.meta && typeof p.meta === 'object' ? p.meta : {}) as Record<string, unknown>;
        const wc = typeof meta.wordCount === 'number' ? meta.wordCount : 0;
        const desc = typeof meta.description === 'string' ? meta.description : '';
        const topicSummary = (desc || p.title || '').toString().slice(0, 240);
        return {
          url: normalizeUrlPath(p.url),
          type: p.type,
          title: (p.title || p.url).slice(0, 200),
          wordCount: wc,
          topicSummary,
        };
      });

      const bundle: ContextBundle = {
        siteUrl: site.url,
        cms: site.cms,
        extensions: [],
        pages,
        contentGaps: buildContentGaps(site.pages),
        existingIdeasSummary,
      };

      const system = `You are a senior agency strategist. You produce decision-ready website improvement ideas (pitch briefings).
Return ONLY valid JSON with this exact shape:
{
  "ideas": [
    {
      "title": "string, max 8 words, action-oriented",
      "pitchText": "string, 2-3 sentences, plain language for non-technical buyers, no markdown",
      "cmsHint": "string or null, CMS-specific implementation hint",
      "type": "blog_post|seo_fix|new_section|api_integration|feature|other",
      "areas": ["content"|"seo"|"feature"|"ux"] (1-3 items),
      "complexity": "low"|"medium"|"high",
      "estimatedHours": number (realistic for the CMS),
      "requiresDev": boolean,
      "confidence": number 0-1,
      "impactScore": number 0-1,
      "reasoning": "short technical rationale",
      "sourcePageUrls": ["paths from context pages.url, best evidence"]
    }
  ]
}
Rules: at most ${MAX_IDEAS_PER_RUN} ideas; avoid overlapping concepts with existingIdeasSummary; each idea must cite at least one sourcePageUrls from the bundle pages.`;

      const user = `Context bundle:\n${JSON.stringify(bundle)}`;

      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.45,
        max_tokens: 4500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const text = completion.choices[0]?.message?.content || '{}';
      let parsed: { ideas?: RawIdea[] };
      try {
        parsed = JSON.parse(text) as { ideas?: RawIdea[] };
      } catch {
        this.logger.warn('GPT returned non-JSON for ideas job');
        return;
      }

      const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, MAX_IDEAS_PER_RUN) : [];
      const cms = site.cms as CmsType;

      let progress = 10;
      const step = Math.max(5, Math.floor(80 / Math.max(rawIdeas.length, 1)));

      for (const raw of rawIdeas) {
        progress = Math.min(95, progress + step);
        await this.persistOneIdea(client, orgId, siteId, cms, raw, site.pages, site.name);
        this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'running', progress });
      }

      this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'done', progress: 100 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.opts.attempts ?? 2;
      if (job.attemptsMade >= attempts) {
        this.events.emitError(orgId, {
          siteId,
          type: 'ideas_error',
          message,
          retryable: true,
        });
        this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'failed', progress: 0 });
      }
      throw err;
    } finally {
      await this.prisma.site.update({ where: { id: siteId }, data: { status: 'idle' } });
      await this.queueStats.emitForOrg(orgId);
    }
  }

  private async persistOneIdea(
    client: OpenAI,
    orgId: string,
    siteId: string,
    cms: CmsType,
    raw: RawIdea,
    pages: { id: string; url: string; type: PageType }[],
    siteName: string,
  ) {
    const title = (raw.title || '').trim().slice(0, 512);
    const pitchText = (raw.pitchText || '').trim();
    if (!title || pitchText.length < 20) return;

    const conf = typeof raw.confidence === 'number' ? raw.confidence : 0.75;
    if (conf < MIN_CONFIDENCE) return;

    const kind = normalizeIdeaKind(raw.type);
    const base = baseScore(kind, cms);
    const complexity =
      raw.complexity === 'low' || raw.complexity === 'medium' || raw.complexity === 'high'
        ? raw.complexity
        : base.complexity;
    let hours =
      typeof raw.estimatedHours === 'number' && Number.isFinite(raw.estimatedHours)
        ? Math.round(raw.estimatedHours)
        : base.hours;
    hours = Math.max(1, Math.min(120, hours));
    const requiresDev = typeof raw.requiresDev === 'boolean' ? raw.requiresDev : base.requiresDev;
    const impact =
      typeof raw.impactScore === 'number' && Number.isFinite(raw.impactScore)
        ? Math.max(0, Math.min(1, raw.impactScore))
        : 0.55;
    const areas = clampAreas(raw.areas);
    const cmsHint = (raw.cmsHint && String(raw.cmsHint).trim()) || null;
    const reasoning = (raw.reasoning && String(raw.reasoning).trim()) || null;

    const embedText = `${title}\n${pitchText}`.slice(0, 8000);
    const emb = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: embedText,
    });
    const vector = emb.data[0]?.embedding;
    if (!vector || vector.length !== 1536) return;

    const literal = `[${vector.join(',')}]`;
    const dup = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM ideas
       WHERE site_id = $1::uuid
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $2::vector) > $3
       LIMIT 1`,
      siteId,
      literal,
      DEDUP_THRESHOLD,
    );
    if (dup.length > 0) return;

    const sourceUrls: string[] = Array.isArray(raw.sourcePageUrls)
      ? raw.sourcePageUrls.map((u) => String(u).trim()).filter(Boolean)
      : [];

    const matchedPageIds = new Set<string>();
    for (const su of sourceUrls) {
      const norm = su.startsWith('http') ? normalizeUrlPath(su) : su;
      for (const p of pages) {
        const pPath = normalizeUrlPath(p.url);
        if (pPath === norm || p.url.endsWith(norm) || pPath.endsWith(norm)) {
          matchedPageIds.add(p.id);
        }
      }
    }
    if (matchedPageIds.size === 0 && pages[0]) {
      matchedPageIds.add(pages[0].id);
    }

    const idea = await this.prisma.idea.create({
      data: {
        siteId,
        title,
        pitchText,
        description: reasoning,
        cmsHint,
        complexity,
        estimatedHours: hours,
        requiresDev,
        areas,
        confidence: conf,
        impactScore: impact,
        status: 'open',
      },
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE ideas SET embedding = $1::vector WHERE id = $2::uuid`,
      literal,
      idea.id,
    );

    for (const pageId of matchedPageIds) {
      await this.prisma.ideaSource.create({
        data: { ideaId: idea.id, pageId },
      }).catch(() => undefined);
    }

    this.events.emitIdeaNew(orgId, {
      ideaId: idea.id,
      siteId,
      title: idea.title,
    });

    await this.notifier.notifyNewIdea({
      ideaId: idea.id,
      siteId,
      title: idea.title,
      siteName,
    });
  }
}
