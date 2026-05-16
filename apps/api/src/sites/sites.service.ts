import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { computeNextCrawlAt, isValidCronExpression } from '../crawler/cron.util';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    this.logger.debug(`Listing sites for org ${orgId}`);
    return this.prisma.site.findMany({
      where: { orgId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { ideas: true, pages: true } },
        crawlJobs: {
          where: { status: { in: ['queued', 'running'] } },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async get(orgId: string, id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        _count: { select: { ideas: true, pages: true } },
        crawlJobs: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();
    return site;
  }

  async create(orgId: string, dto: CreateSiteDto) {
    const site = await this.prisma.site.create({
      data: { orgId, ...dto },
    });
    this.logger.log(`Site created: ${site.id} (${site.url}) for org ${orgId}`);
    return site;
  }

  async update(orgId: string, id: string, dto: UpdateSiteDto) {
    const prev = await this.assertOwnership(orgId, id);
    const scheduleTouched = dto.scheduleEnabled !== undefined || dto.scheduleCron !== undefined;
    const enabled = dto.scheduleEnabled ?? prev.scheduleEnabled;
    const cronRaw = dto.scheduleCron !== undefined ? dto.scheduleCron : prev.scheduleCron;
    const cron = cronRaw?.trim() || null;

    let nextCrawlAt: Date | null | undefined = undefined;
    if (scheduleTouched) {
      if (enabled) {
        if (!cron) throw new BadRequestException('scheduleCron is required when scheduleEnabled is true');
        if (!isValidCronExpression(cron)) throw new BadRequestException('Invalid scheduleCron expression');
        nextCrawlAt = computeNextCrawlAt(cron, new Date());
        this.logger.debug(`Site ${id} schedule updated — next crawl at ${nextCrawlAt.toISOString()}`);
      } else {
        nextCrawlAt = null;
        this.logger.debug(`Site ${id} schedule disabled`);
      }
    }

    const { scheduleEnabled, scheduleCron, ...rest } = dto;
    const updated = await this.prisma.site.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduleEnabled !== undefined ? { scheduleEnabled } : {}),
        ...(dto.scheduleCron !== undefined ? { scheduleCron: cron } : {}),
        ...(nextCrawlAt !== undefined ? { nextCrawlAt } : {}),
      },
    });
    this.logger.log(`Site ${id} updated for org ${orgId}`);
    return updated;
  }

  async remove(orgId: string, id: string) {
    await this.assertOwnership(orgId, id);
    const deleted = await this.prisma.site.delete({ where: { id } });
    this.logger.log(`Site ${id} deleted for org ${orgId}`);
    return deleted;
  }

  private async assertOwnership(orgId: string, id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();
    return site;
  }
}
