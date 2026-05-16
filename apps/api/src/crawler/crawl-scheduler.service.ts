import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from './crawler.service';
import { computeNextCrawlAt, isValidCronExpression } from './cron.util';

@Injectable()
export class CrawlSchedulerService {
  private readonly logger = new Logger(CrawlSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawler: CrawlerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runDueCrawls() {
    const now = new Date();
    const sites = await this.prisma.site.findMany({
      where: {
        scheduleEnabled: true,
        scheduleCron: { not: null },
        nextCrawlAt: { lte: now },
        status: { notIn: ['crawling', 'analyzing'] },
      },
      take: 8,
    });

    if (sites.length === 0) {
      this.logger.debug('Scheduler tick — no sites due for crawl');
      return;
    }

    this.logger.log(`Scheduler found ${sites.length} site(s) due for crawl`);

    for (const site of sites) {
      const cron = site.scheduleCron?.trim();
      if (!cron || !isValidCronExpression(cron)) {
        this.logger.warn(`Skipping scheduled crawl for site ${site.id} — invalid cron expression: "${site.scheduleCron}"`);
        continue;
      }

      try {
        const ok = await this.crawler.startScheduledCrawl(site.orgId, site.id);
        if (ok) {
          const next = computeNextCrawlAt(cron, new Date());
          await this.prisma.site.update({
            where: { id: site.id },
            data: { nextCrawlAt: next },
          });
          this.logger.log(`Scheduled crawl started for site ${site.id}; next run at ${next.toISOString()}`);
        }
      } catch (e) {
        this.logger.warn(`Scheduled crawl failed for site ${site.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
