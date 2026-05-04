import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CrawlErrorRow {
  at: string;
  siteId: string;
  siteName: string;
  crawlJobId: string;
  url?: string;
  error?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecentCrawlErrors(orgId: string, limit = 40): Promise<CrawlErrorRow[]> {
    const jobs = await this.prisma.crawlJob.findMany({
      where: { site: { orgId } },
      orderBy: { startedAt: 'desc' },
      take: 60,
      include: { site: { select: { name: true } } },
    });

    const out: CrawlErrorRow[] = [];
    for (const job of jobs) {
      const errs = job.errors as unknown[];
      if (!Array.isArray(errs) || errs.length === 0) continue;
      for (const e of errs) {
        const row = e as { url?: string; error?: string; ts?: string };
        out.push({
          at: row.ts || job.finishedAt?.toISOString() || job.startedAt?.toISOString() || '',
          siteId: job.siteId,
          siteName: job.site.name,
          crawlJobId: job.id,
          url: row.url,
          error: row.error,
        });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
}
