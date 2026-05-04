import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { RateLimiterService } from './rate-limiter.service';
import { CRAWL_QUEUE, type CrawlPageJob } from './crawl.constants';
import { PARSE_QUEUE, type ParsePageJob } from './parse.constants';
import { classifyPageFromCrawl } from './page-classifier';
import { truncateRawHtml } from './html-parse';
import { QueueStatsEmitter } from './queue-stats.emitter';

@Processor(CRAWL_QUEUE, { concurrency: 3 })
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);
  private readonly timeout = parseInt(process.env.CRAWLER_TIMEOUT_MS || '10000');
  private readonly maxPages = parseInt(process.env.CRAWLER_MAX_PAGES || '500');

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly rateLimiter: RateLimiterService,
    private readonly queueStats: QueueStatsEmitter,
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
    @InjectQueue(PARSE_QUEUE) private readonly parseQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CrawlPageJob>) {
    const { siteId, crawlJobId, orgId, url, depth, maxDepth } = job.data;

    const crawlJob = await this.prisma.crawlJob.findUnique({ where: { id: crawlJobId } });
    if (!crawlJob || crawlJob.status === 'stopped' || crawlJob.status === 'failed') return;
    if (crawlJob.pagesCrawled >= this.maxPages) return;

    const domain = new URL(url).hostname;
    await this.rateLimiter.acquire(domain);

    let html: string;
    try {
      const resp = await axios.get<string>(url, {
        timeout: this.timeout,
        headers: { 'User-Agent': 'Sitebrief/1.0 (+https://sitebrief.dev)' },
        maxRedirects: 5,
      });
      html = resp.data as string;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch ${url}: ${message}`);
      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: { errors: { push: { url, error: message, ts: new Date().toISOString() } } },
      });
      this.events.emitError(orgId, { siteId, type: 'fetch_error', message, retryable: true });
      return;
    }

    const $ = cheerio.load(html);
    const title = $('title').text().trim() || $('h1').first().text().trim() || url;
    const contentHash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 64);

    const pageType = classifyPageFromCrawl(url, $);
    const rawHtml = truncateRawHtml(html);
    const meta = {
      wordCount: $('body').text().split(/\s+/).filter(Boolean).length,
      description: $('meta[name="description"]').attr('content') || null,
    } as object;

    const existing = await this.prisma.page.findUnique({
      where: { siteId_url: { siteId, url } },
    });

    let pageId: string;
    let needsParse = true;

    if (existing?.contentHash === contentHash && existing.parsedAt) {
      await this.prisma.page.update({
        where: { id: existing.id },
        data: {
          crawlJobId,
          title: title.slice(0, 512),
          type: pageType,
          meta,
        },
      });
      pageId = existing.id;
      needsParse = false;
    } else if (existing) {
      await this.prisma.$executeRawUnsafe(`UPDATE pages SET embedding = NULL WHERE id = $1::uuid`, existing.id);
      const updated = await this.prisma.page.update({
        where: { id: existing.id },
        data: {
          crawlJobId,
          title: title.slice(0, 512),
          type: pageType,
          contentHash,
          rawHtml,
          parsedAt: null,
          meta,
        },
      });
      pageId = updated.id;
      needsParse = true;
    } else {
      const created = await this.prisma.page.create({
        data: {
          siteId,
          crawlJobId,
          url,
          title: title.slice(0, 512),
          type: pageType,
          contentHash,
          rawHtml,
          parsedAt: null,
          meta,
        },
      });
      pageId = created.id;
      needsParse = true;
    }

    if (needsParse) {
      await this.parseQueue.add(
        'parse:extract',
        { pageId, orgId, siteId } satisfies ParsePageJob,
        { attempts: 2, backoff: { type: 'exponential', delay: 2000 } },
      );
    }
    void this.queueStats.emitForOrg(orgId);

    const updated = await this.prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { pagesCrawled: { increment: 1 } },
    });

    const progress = updated.pagesTotal > 0
      ? Math.round((updated.pagesCrawled / updated.pagesTotal) * 100)
      : 0;

    this.events.emitJobUpdate(orgId, {
      jobId: crawlJobId,
      siteId,
      status: 'running',
      progress,
    });
    if (needsParse) {
      this.events.emitCrawlPage(orgId, { siteId, url, pageType });
    }

    if (depth < maxDepth && updated.pagesCrawled < this.maxPages) {
      const baseUrl = new URL(url);
      const links: string[] = [];

      $('a[href]').each((_, el) => {
        try {
          const href = $(el).attr('href') || '';
          const resolved = new URL(href, baseUrl).toString();
          if (new URL(resolved).hostname === baseUrl.hostname && !job.data.visitedUrls.includes(resolved)) {
            links.push(resolved);
          }
        } catch {}
      });

      const uniqueLinks = [...new Set(links)].slice(0, 50);
      if (uniqueLinks.length > 0) {
        await this.prisma.crawlJob.update({
          where: { id: crawlJobId },
          data: { pagesTotal: { increment: uniqueLinks.length } },
        });

        for (const link of uniqueLinks) {
          await this.crawlQueue.add('crawl:page', {
            siteId,
            crawlJobId,
            orgId,
            url: link,
            depth: depth + 1,
            maxDepth,
            visitedUrls: [...job.data.visitedUrls, url],
          } satisfies CrawlPageJob, {
            priority: 5,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });
        }
      }
    }

    if (updated.pagesCrawled >= updated.pagesTotal && updated.pagesTotal > 0) {
      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: { status: 'done', finishedAt: new Date() },
      });
      await this.prisma.site.update({ where: { id: siteId }, data: { status: 'idle' } });
      this.events.emitJobUpdate(orgId, { jobId: crawlJobId, siteId, status: 'done', progress: 100 });
    }
  }
}
