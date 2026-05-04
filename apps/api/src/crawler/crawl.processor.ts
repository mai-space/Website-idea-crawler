import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { RateLimiterService } from './rate-limiter.service';

export const CRAWL_QUEUE = 'crawl-queue';

export interface CrawlPageJob {
  siteId: string;
  crawlJobId: string;
  orgId: string;
  url: string;
  depth: number;
  maxDepth: number;
  visitedUrls: string[];
}

@Processor(CRAWL_QUEUE, { concurrency: 3 })
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);
  private readonly timeout = parseInt(process.env.CRAWLER_TIMEOUT_MS || '10000');
  private readonly maxPages = parseInt(process.env.CRAWLER_MAX_PAGES || '500');

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly rateLimiter: RateLimiterService,
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
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

    const pageType = this.classifyPage(url, $);

    await this.prisma.page.upsert({
      where: { id: `${crawlJobId}-${Buffer.from(url).toString('base64').slice(0, 32)}` },
      create: {
        id: `${crawlJobId}-${Buffer.from(url).toString('base64').slice(0, 32)}`,
        siteId,
        crawlJobId,
        url,
        title: title.slice(0, 512),
        type: pageType,
        contentHash,
        parsedAt: new Date(),
        meta: {
          wordCount: $('body').text().split(/\s+/).length,
          description: $('meta[name="description"]').attr('content') || null,
        },
      },
      update: { contentHash, title: title.slice(0, 512), parsedAt: new Date() },
    });

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
    this.events.emitCrawlPage(orgId, { siteId, url, pageType });

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

  private classifyPage(url: string, $: cheerio.CheerioAPI): 'landing' | 'blog' | 'product' | 'docs' | 'other' {
    const path = new URL(url).pathname.toLowerCase();
    if (path === '/' || path === '') return 'landing';
    if (/\/(blog|news|artikel|beitrag)/.test(path)) return 'blog';
    if (/\/(produkt|product|shop|leistung|service)/.test(path)) return 'product';
    if (/\/(docs|documentation|hilfe|help|wiki)/.test(path)) return 'docs';

    const h1 = $('h1').first().text().toLowerCase();
    if (/blog|news/.test(h1)) return 'blog';
    if (/produkt|product|shop/.test(h1)) return 'product';

    return 'other';
  }
}
