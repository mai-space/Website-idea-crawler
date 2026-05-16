import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { JobTrigger, PageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CRAWL_QUEUE, type CrawlPageJob } from './crawl.constants';
import { PARSE_QUEUE } from './parse.constants';
import { IDEAS_QUEUE } from './ideas.constants';
import { SitemapService } from './sitemap.service';

export interface StartCrawlDto {
  depth?: number;
  maxPages?: number;
}

export interface StartCrawlOptions {
  triggeredBy?: JobTrigger;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly sitemapService: SitemapService,
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
    @InjectQueue(PARSE_QUEUE) private readonly parseQueue: Queue,
    @InjectQueue(IDEAS_QUEUE) private readonly ideasQueue: Queue,
  ) {}

  async startCrawl(orgId: string, siteId: string, dto: StartCrawlDto = {}, opts: StartCrawlOptions = {}) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();
    if (site.status === 'crawling') throw new BadRequestException('Crawl already running');

    const maxDepth = dto.depth ?? parseInt(process.env.CRAWLER_DEFAULT_DEPTH || '3');
    const triggeredBy = opts.triggeredBy ?? 'manual';

    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        siteId,
        status: 'queued',
        triggeredBy,
        pagesTotal: 1,
        pagesCrawled: 0,
        startedAt: new Date(),
      },
    });

    await this.prisma.site.update({ where: { id: siteId }, data: { status: 'crawling' } });

    const maxPages = dto.maxPages ?? parseInt(process.env.CRAWLER_MAX_PAGES || '500');
    const jobPriority = site.priority * 10 + 5;

    // --- Sitemap-first strategy ---
    // Try to get the full URL list from the site's sitemap before falling back to
    // depth-first link following. This is dramatically faster for large sites.
    const sitemapUrls = await this.sitemapService.discoverUrls(site.url, maxPages);

    if (sitemapUrls.length > 0) {
      this.logger.log(`Sitemap found ${sitemapUrls.length} URLs for site ${siteId}; skipping recursive crawl`);
      await this.prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: { pagesTotal: sitemapUrls.length },
      });

      const jobs = sitemapUrls.map((url) => ({
        name: 'crawl:page' as const,
        data: {
          siteId,
          crawlJobId: crawlJob.id,
          orgId,
          url,
          depth: 0,
          maxDepth: 0, // no recursive link-following needed
          visitedUrls: [],
        } satisfies CrawlPageJob,
        opts: { priority: jobPriority, attempts: 3, backoff: { type: 'exponential' as const, delay: 1000 } },
      }));

      // BullMQ bulk add is far more efficient than N individual .add() calls
      await this.crawlQueue.addBulk(jobs);
    } else {
      // Fall back to the original depth-first recursive crawl
      await this.crawlQueue.add(
        'crawl:page',
        {
          siteId,
          crawlJobId: crawlJob.id,
          orgId,
          url: site.url,
          depth: 0,
          maxDepth,
          visitedUrls: [],
        } satisfies CrawlPageJob,
        { priority: jobPriority, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
    }

    await this.prisma.crawlJob.update({ where: { id: crawlJob.id }, data: { status: 'running' } });

    this.events.emitJobUpdate(orgId, { jobId: crawlJob.id, siteId, status: 'running', progress: 0 });

    return { jobId: crawlJob.id, status: 'running', estimatedDuration: 120 };
  }

  /** Used by scheduler; returns false if crawl could not start (e.g. already running). */
  async startScheduledCrawl(orgId: string, siteId: string): Promise<boolean> {
    try {
      await this.startCrawl(orgId, siteId, {}, { triggeredBy: 'scheduled' });
      return true;
    } catch (err: unknown) {
      this.logger.warn(`Scheduled crawl skipped for site ${siteId}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async stopCrawl(orgId: string, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    const activeJob = await this.prisma.crawlJob.findFirst({
      where: { siteId, status: { in: ['queued', 'running'] } },
      orderBy: { startedAt: 'desc' },
    });

    if (activeJob) {
      await this.prisma.crawlJob.update({
        where: { id: activeJob.id },
        data: { status: 'stopped', finishedAt: new Date() },
      });
      this.logger.log(`Crawl job ${activeJob.id} stopped for site ${siteId}`);
    } else {
      this.logger.warn(`stopCrawl called for site ${siteId} but no active job found — resetting status anyway`);
    }

    await this.prisma.site.update({ where: { id: siteId }, data: { status: 'idle' } });
    this.events.emitJobUpdate(orgId, {
      jobId: activeJob?.id || '',
      siteId,
      status: 'stopped',
      progress: 0,
    });

    return { status: 'stopped' };
  }

  async getStatus(orgId: string, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    const activeJob = await this.prisma.crawlJob.findFirst({
      where: { siteId, status: { in: ['queued', 'running'] } },
      orderBy: { startedAt: 'desc' },
    });

    const [crawlCount, parseCount, ideasCount] = await Promise.all([
      this.crawlQueue.getWaitingCount(),
      this.parseQueue.getWaitingCount(),
      this.ideasQueue.getWaitingCount(),
    ]);

    return {
      siteStatus: site.status,
      activeJob,
      queueStats: { crawl: crawlCount, parse: parseCount, ideas: ideasCount, workers: 10 },
    };
  }

  async getPages(orgId: string, siteId: string, type?: PageType) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    return this.prisma.page.findMany({
      where: { siteId, ...(type ? { type } : {}) },
      orderBy: [{ parsedAt: 'desc' }, { url: 'asc' }],
      select: {
        id: true,
        siteId: true,
        crawlJobId: true,
        url: true,
        type: true,
        title: true,
        contentHash: true,
        parsedAt: true,
        meta: true,
      },
    });
  }
}
