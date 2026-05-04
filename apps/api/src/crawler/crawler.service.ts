import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CRAWL_QUEUE, CrawlPageJob } from './crawl.processor';

export interface StartCrawlDto {
  depth?: number;
  maxPages?: number;
}

@Injectable()
export class CrawlerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
  ) {}

  async startCrawl(orgId: string, siteId: string, dto: StartCrawlDto = {}) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();
    if (site.status === 'crawling') throw new BadRequestException('Crawl already running');

    const maxDepth = dto.depth ?? parseInt(process.env.CRAWLER_DEFAULT_DEPTH || '3');

    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        siteId,
        status: 'queued',
        triggeredBy: 'manual',
        pagesTotal: 1,
        pagesCrawled: 0,
        startedAt: new Date(),
      },
    });

    await this.prisma.site.update({ where: { id: siteId }, data: { status: 'crawling' } });

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
      {
        priority: site.priority * 10 + 5,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    await this.prisma.crawlJob.update({ where: { id: crawlJob.id }, data: { status: 'running' } });

    this.events.emitJobUpdate(orgId, { jobId: crawlJob.id, siteId, status: 'running', progress: 0 });

    return { jobId: crawlJob.id, status: 'running', estimatedDuration: 120 };
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
      Promise.resolve(0),
      Promise.resolve(0),
    ]);

    return {
      siteStatus: site.status,
      activeJob,
      queueStats: { crawl: crawlCount, parse: parseCount, ideas: ideasCount, workers: 3 },
    };
  }

  async getPages(orgId: string, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    return this.prisma.page.findMany({
      where: { siteId },
      orderBy: { parsedAt: 'desc' },
    });
  }
}
