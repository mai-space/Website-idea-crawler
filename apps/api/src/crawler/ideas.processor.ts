import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
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

// JSON schema shared between the Claude tool definition and OpenAI JSON-mode prompt
const IDEA_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Max 8 words, action-oriented' },
    pitchText: { type: 'string', description: '2-3 sentences, plain language for non-technical buyers, no markdown' },
    cmsHint: { type: ['string', 'null'], description: 'CMS-specific implementation hint, or null' },
    type: { type: 'string', enum: ['blog_post', 'seo_fix', 'new_section', 'api_integration', 'feature', 'other'] },
    areas: {
      type: 'array',
      items: { type: 'string', enum: ['content', 'seo', 'feature', 'ux'] },
      minItems: 1,
      maxItems: 3,
    },
    complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
    estimatedHours: { type: 'number', description: 'Realistic hours for the CMS' },
    requiresDev: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    impactScore: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string', description: 'Short technical rationale' },
    sourcePageUrls: {
      type: 'array',
      items: { type: 'string' },
      description: 'URL paths from the context bundle that best support this idea',
    },
  },
  required: ['title', 'pitchText', 'type', 'areas', 'complexity', 'estimatedHours', 'requiresDev', 'confidence'],
} as const;

const IDEAS_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    ideas: {
      type: 'array',
      items: IDEA_ITEM_SCHEMA,
      maxItems: MAX_IDEAS_PER_RUN,
    },
  },
  required: ['ideas'],
} as const;

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

const SYSTEM_PROMPT = `You are a senior agency strategist. Your job is to produce decision-ready website improvement ideas (pitch briefings) for an agency's clients.

Guidelines:
- Each idea must be specific, actionable, and backed by evidence from the site's pages.
- Pitch text should be plain language suitable for non-technical clients — no markdown, no jargon.
- Hour estimates must be realistic for the given CMS type.
- Avoid generic ideas (e.g. "add more content") — be concrete about what to add and where.
- Do not repeat ideas that already exist (see existingIdeasSummary in the bundle).
- Prioritise high-impact, low-complexity opportunities where the evidence is clear.`;

@Processor(IDEAS_QUEUE, { concurrency: 2 })
export class IdeasProcessor extends WorkerHost {
  private readonly logger = new Logger(IdeasProcessor.name);
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly queueStats: QueueStatsEmitter,
    private readonly notifier: NotifierService,
  ) {
    super();
  }

  private getAnthropic(): Anthropic | null {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key?.trim() || key.startsWith('sk-ant-...')) return null;
    if (!this.anthropic) this.anthropic = new Anthropic({ apiKey: key });
    return this.anthropic;
  }

  private getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim() || key === 'sk-...') return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  async process(job: Job<GenerateIdeasJob>) {
    const { orgId, siteId } = job.data;

    try {
      const anthropic = this.getAnthropic();
      const openai = this.getOpenAI();

      if (!anthropic && !openai) {
        this.logger.warn('No AI key configured (ANTHROPIC_API_KEY or OPENAI_API_KEY) — ideas job skipped');
        return;
      }

      this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'running', progress: 5 });

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
      const existingIdeasSummary = statusCounts.length
        ? statusCounts.map((r) => `${r._count._all} ${r.status}`).join(', ')
        : 'none yet';

      const pages: ContextPage[] = site.pages.map((p) => {
        const meta = (p.meta && typeof p.meta === 'object' ? p.meta : {}) as Record<string, unknown>;
        const wc = typeof meta.wordCount === 'number' ? meta.wordCount : 0;
        const desc = typeof meta.description === 'string' ? meta.description : '';
        const h1 = typeof meta.h1 === 'string' ? meta.h1 : '';
        const topicSummary = (h1 || desc || p.title || '').slice(0, 280);
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

      let rawIdeas: RawIdea[];

      if (anthropic) {
        rawIdeas = await this.generateWithClaude(anthropic, bundle);
      } else {
        rawIdeas = await this.generateWithOpenAI(openai!, bundle);
      }

      this.logger.log(`AI returned ${rawIdeas.length} raw ideas for site ${siteId}`);

      const cms = site.cms as CmsType;
      let progress = 10;
      const step = Math.max(5, Math.floor(80 / Math.max(rawIdeas.length, 1)));

      for (const raw of rawIdeas.slice(0, MAX_IDEAS_PER_RUN)) {
        progress = Math.min(95, progress + step);
        try {
          await this.persistOneIdea(openai, orgId, siteId, cms, raw, site.pages, site.name);
        } catch (err: unknown) {
          this.logger.warn(`Failed to persist idea "${raw.title ?? '(no title)'}": ${err instanceof Error ? err.message : String(err)}`);
        }
        this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'running', progress });
      }

      this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'done', progress: 100 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.opts.attempts ?? 2;
      this.logger.error(`Ideas job failed for site ${siteId} (attempt ${job.attemptsMade + 1}/${attempts}): ${message}`, err instanceof Error ? err.stack : undefined);
      if (job.attemptsMade >= attempts) {
        this.events.emitError(orgId, { siteId, type: 'ideas_error', message, retryable: true });
        this.events.emitJobUpdate(orgId, { jobId: String(job.id), siteId, status: 'failed', progress: 0 });
      }
      throw err;
    } finally {
      await this.prisma.site.update({ where: { id: siteId }, data: { status: 'idle' } });
      await this.queueStats.emitForOrg(orgId);
    }
  }

  // ---------------------------------------------------------------------------
  // Claude — tool_use gives reliable structured output without JSON mode
  // ---------------------------------------------------------------------------
  private async generateWithClaude(client: Anthropic, bundle: ContextBundle): Promise<RawIdea[]> {
    let response: Awaited<ReturnType<typeof client.messages.create>>;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'record_ideas',
            description: `Record up to ${MAX_IDEAS_PER_RUN} website improvement ideas for the given site.`,
            input_schema: IDEAS_RESPONSE_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: 'record_ideas' },
        messages: [
          {
            role: 'user',
            content: `Analyse this site context and record the most valuable improvement ideas.\n\nContext bundle:\n${JSON.stringify(bundle, null, 2)}`,
          },
        ],
      });
    } catch (err: unknown) {
      this.logger.error(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }

    const toolBlock = response.content.find((b) => b.type === 'tool_use');
    if (toolBlock?.type !== 'tool_use') {
      this.logger.warn('Claude did not call the record_ideas tool');
      return [];
    }

    const input = toolBlock.input as { ideas?: RawIdea[] };
    return Array.isArray(input.ideas) ? input.ideas : [];
  }

  // ---------------------------------------------------------------------------
  // OpenAI GPT-4o fallback — kept for backwards compatibility
  // ---------------------------------------------------------------------------
  private async generateWithOpenAI(client: OpenAI, bundle: ContextBundle): Promise<RawIdea[]> {
    const system = `${SYSTEM_PROMPT}
Return ONLY valid JSON matching this schema:
${JSON.stringify(IDEAS_RESPONSE_SCHEMA, null, 2)}
Rules: at most ${MAX_IDEAS_PER_RUN} ideas; avoid overlapping concepts with existingIdeasSummary; each idea must cite at least one sourcePageUrls from the bundle pages.`;

    let completion: Awaited<ReturnType<typeof client.chat.completions.create>>;
    try {
      completion = await client.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.45,
        max_tokens: 4500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Context bundle:\n${JSON.stringify(bundle)}` },
        ],
      });
    } catch (err: unknown) {
      this.logger.error(`OpenAI API call failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }

    const text = completion.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(text) as { ideas?: RawIdea[] };
      return Array.isArray(parsed.ideas) ? parsed.ideas : [];
    } catch {
      this.logger.warn('GPT-4o returned non-JSON for ideas job');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Persist one idea (shared by both code paths)
  // ---------------------------------------------------------------------------
  private async persistOneIdea(
    openaiClient: OpenAI | null,
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

    // Embeddings are OpenAI-only (Claude has no embeddings API); skip dedup if unavailable
    if (openaiClient) {
      const embedText = `${title}\n${pitchText}`.slice(0, 8000);
      const emb = await openaiClient.embeddings.create({
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
      if (dup.length > 0) {
        this.logger.debug(`Idea "${title}" skipped — duplicate detected (threshold=${DEDUP_THRESHOLD})`);
        return;
      }

      const sourceUrls: string[] = Array.isArray(raw.sourcePageUrls)
        ? raw.sourcePageUrls.map((u) => String(u).trim()).filter(Boolean)
        : [];

      const matchedPageIds = this.matchSourcePages(sourceUrls, pages);

      const idea = await this.prisma.idea.create({
        data: {
          siteId, title, pitchText,
          description: reasoning, cmsHint, complexity,
          estimatedHours: hours, requiresDev, areas,
          confidence: conf, impactScore: impact, status: 'open',
        },
      });

      await this.prisma.$executeRawUnsafe(
        `UPDATE ideas SET embedding = $1::vector WHERE id = $2::uuid`,
        literal,
        idea.id,
      );

      for (const pageId of matchedPageIds) {
        await this.prisma.ideaSource.create({ data: { ideaId: idea.id, pageId } }).catch(() => undefined);
      }

      this.events.emitIdeaNew(orgId, { ideaId: idea.id, siteId, title: idea.title });
      await this.notifier.notifyNewIdea({ ideaId: idea.id, siteId, title: idea.title, siteName });
      return;
    }

    // No embedding available — persist without deduplication
    const sourceUrls: string[] = Array.isArray(raw.sourcePageUrls)
      ? raw.sourcePageUrls.map((u) => String(u).trim()).filter(Boolean)
      : [];
    const matchedPageIds = this.matchSourcePages(sourceUrls, pages);

    const idea = await this.prisma.idea.create({
      data: {
        siteId, title, pitchText,
        description: reasoning, cmsHint, complexity,
        estimatedHours: hours, requiresDev, areas,
        confidence: conf, impactScore: impact, status: 'open',
      },
    });

    for (const pageId of matchedPageIds) {
      await this.prisma.ideaSource.create({ data: { ideaId: idea.id, pageId } }).catch(() => undefined);
    }

    this.events.emitIdeaNew(orgId, { ideaId: idea.id, siteId, title: idea.title });
    await this.notifier.notifyNewIdea({ ideaId: idea.id, siteId, title: idea.title, siteName });
  }

  private matchSourcePages(
    sourceUrls: string[],
    pages: { id: string; url: string }[],
  ): Set<string> {
    const matched = new Set<string>();
    for (const su of sourceUrls) {
      const norm = su.startsWith('http') ? normalizeUrlPath(su) : su;
      for (const p of pages) {
        const pPath = normalizeUrlPath(p.url);
        if (pPath === norm || p.url.endsWith(norm) || pPath.endsWith(norm)) {
          matched.add(p.id);
        }
      }
    }
    if (matched.size === 0 && pages[0]) matched.add(pages[0].id);
    return matched;
  }
}
