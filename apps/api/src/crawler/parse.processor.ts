import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import OpenAI from 'openai';
import type { PageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { PARSE_QUEUE, type ParsePageJob } from './parse.constants';
import { extractFromHtml, cleanForMainText, mainBodyText, wordCount, isPageMeaningful } from './html-parse';
import { classifyPageAfterParse } from './page-classifier';
import { QueueStatsEmitter } from './queue-stats.emitter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Processor(PARSE_QUEUE, { concurrency: 5 })
export class ParseProcessor extends WorkerHost {
  private readonly logger = new Logger(ParseProcessor.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly queueStats: QueueStatsEmitter,
  ) {
    super();
  }

  private getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  async process(job: Job<ParsePageJob>) {
    const { pageId, orgId, siteId } = job.data;
    if (!UUID_RE.test(pageId)) {
      this.logger.warn(`Invalid pageId for parse job: ${pageId}`);
      return;
    }

    const page = await this.prisma.page.findUnique({ where: { id: pageId } });
    if (!page?.rawHtml) {
      this.logger.debug(`Skip parse — no raw HTML for page ${pageId}`);
      return;
    }

    try {
      const { $, meta } = extractFromHtml(page.rawHtml);
      const cleaned = cleanForMainText($);
      const bodyText = mainBodyText(cleaned);
      const wc = wordCount(bodyText);
      const refinedType: PageType = classifyPageAfterParse(page.url, $, bodyText);

      const title = (meta.title || page.title || page.url).slice(0, 512);
      const nextMeta = {
        ...(typeof page.meta === 'object' && page.meta !== null ? (page.meta as Record<string, unknown>) : {}),
        description: meta.description,
        ogTitle: meta.ogTitle,
        h1: meta.h1,
        canonical: meta.canonical,
        wordCount: wc,
        parseJob: job.name,
      };

      const client = this.getOpenAI();
      if (client && isPageMeaningful(bodyText)) {
        const input = bodyText.slice(0, 8000);
        const emb = await client.embeddings.create({
          model: 'text-embedding-3-small',
          input,
        });
        const vector = emb.data[0]?.embedding;
        if (vector?.length === 1536) {
          const literal = `[${vector.join(',')}]`;
          await this.prisma.$executeRawUnsafe(
            `UPDATE pages SET embedding = $1::vector WHERE id = $2::uuid`,
            literal,
            pageId,
          );
        }
      } else if (!client) {
        this.logger.debug('OPENAI_API_KEY missing — skipped embedding');
      }

      await this.prisma.page.update({
        where: { id: pageId },
        data: {
          title,
          type: refinedType,
          parsedAt: new Date(),
          rawHtml: null,
          meta: nextMeta as object,
        },
      });

      this.events.emitCrawlPage(orgId, { siteId, url: page.url, pageType: refinedType });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.opts.attempts ?? 2;
      if (job.attemptsMade >= attempts) {
        const prev = typeof page.meta === 'object' && page.meta !== null ? (page.meta as Record<string, unknown>) : {};
        await this.prisma.page.update({
          where: { id: pageId },
          data: {
            meta: { ...prev, parseError: message, parseFailedAt: new Date().toISOString() } as object,
          },
        });
        this.events.emitError(orgId, {
          siteId,
          type: 'parse_error',
          message,
          retryable: false,
        });
      }
      throw err;
    } finally {
      await this.queueStats.emitForOrg(orgId);
    }
  }
}
