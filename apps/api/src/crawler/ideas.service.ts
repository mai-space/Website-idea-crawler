import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { IdeaComplexity, IdeaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { QueueStatsEmitter } from './queue-stats.emitter';
import { IDEAS_QUEUE, type GenerateIdeasJob } from './ideas.constants';
import type { ListIdeasQueryDto } from './dto/list-ideas-query.dto';
import type { PatchIdeaDto } from './dto/patch-idea.dto';
import type { BulkIdeasDto } from './dto/bulk-ideas.dto';

@Injectable()
export class IdeasService {
  private readonly logger = new Logger(IdeasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(IDEAS_QUEUE) private readonly ideasQueue: Queue,
    private readonly queueStats: QueueStatsEmitter,
    private readonly events: EventsGateway,
  ) {}

  async enqueueGenerate(orgId: string, siteId: string) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const hasAnthropic = anthropicKey && !anthropicKey.startsWith('sk-ant-...');
    const hasOpenAI = openaiKey && !openaiKey.startsWith('sk-...');
    if (!hasAnthropic && !hasOpenAI) {
      throw new BadRequestException('OPENAI_API_KEY or ANTHROPIC_API_KEY is required for idea generation');
    }

    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    if (site.status === 'crawling') {
      throw new BadRequestException('Wait until the crawl finishes before generating ideas');
    }

    const parsedCount = await this.prisma.page.count({
      where: { siteId, parsedAt: { not: null } },
    });
    if (parsedCount === 0) {
      throw new BadRequestException('No parsed pages yet — run a crawl and wait for parsing first');
    }

    const lock = await this.prisma.site.updateMany({
      where: { id: siteId, orgId, status: { notIn: ['analyzing'] } },
      data: { status: 'analyzing' },
    });
    if (lock.count === 0) {
      throw new BadRequestException('Idea generation already running for this site');
    }

    try {
      const job = await this.ideasQueue.add(
        'ideas:pipeline',
        { orgId, siteId } satisfies GenerateIdeasJob,
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      this.logger.log(`Ideas generation job ${String(job.id)} queued for site ${siteId} (org ${orgId})`);
      await this.queueStats.emitForOrg(orgId);
      return { jobId: String(job.id), status: 'queued' as const };
    } catch (e) {
      this.logger.error(`Failed to enqueue ideas generation for site ${siteId}: ${e instanceof Error ? e.message : String(e)}`);
      await this.prisma.site.update({ where: { id: siteId }, data: { status: 'idle' } });
      throw e;
    }
  }

  async listForSite(orgId: string, siteId: string, q: ListIdeasQueryDto) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();

    const where = this.buildWhereForSite(siteId, q);
    const orderBy = this.buildOrderBy(q.sort);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.idea.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          siteId: true,
          title: true,
          pitchText: true,
          cmsHint: true,
          complexity: true,
          estimatedHours: true,
          customHours: true,
          requiresDev: true,
          areas: true,
          confidence: true,
          impactScore: true,
          status: true,
          generatedAt: true,
        },
      }),
      this.prisma.idea.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async listForOrg(orgId: string, q: ListIdeasQueryDto) {
    const where: Prisma.IdeaWhereInput = { site: { orgId } };
    if (q.site_id) {
      const owned = await this.prisma.site.findFirst({
        where: { id: q.site_id, orgId },
        select: { id: true },
      });
      if (!owned) throw new BadRequestException('Invalid site_id for this organization');
      where.siteId = q.site_id;
    }
    if (q.complexity) where.complexity = q.complexity as IdeaComplexity;
    if (q.status) where.status = q.status as IdeaStatus;
    if (q.requires_dev === 'true') where.requiresDev = true;
    if (q.requires_dev === 'false') where.requiresDev = false;
    if (q.area) where.areas = { has: q.area };

    const orderBy = this.buildOrderBy(q.sort);
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.idea.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          siteId: true,
          title: true,
          pitchText: true,
          cmsHint: true,
          complexity: true,
          estimatedHours: true,
          customHours: true,
          requiresDev: true,
          areas: true,
          confidence: true,
          impactScore: true,
          status: true,
          generatedAt: true,
          site: { select: { id: true, name: true, url: true } },
        },
      }),
      this.prisma.idea.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getOrgStats(orgId: string) {
    const where: Prisma.IdeaWhereInput = { site: { orgId } };
    const [total, byStatus, byComplexity, openHighImpact] = await Promise.all([
      this.prisma.idea.count({ where }),
      this.prisma.idea.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.idea.groupBy({
        by: ['complexity'],
        where,
        _count: { _all: true },
      }),
      this.prisma.idea.count({
        where: { site: { orgId }, status: 'open', impactScore: { gte: 0.7 } },
      }),
    ]);

    return {
      total,
      openHighImpact,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      byComplexity: Object.fromEntries(byComplexity.map((r) => [r.complexity, r._count._all])),
    };
  }

  async bulkSetStatus(orgId: string, dto: BulkIdeasDto) {
    const ideas = await this.prisma.idea.findMany({
      where: { id: { in: dto.ids }, site: { orgId } },
      select: { id: true, siteId: true },
    });
    if (ideas.length !== dto.ids.length) {
      throw new BadRequestException('One or more ideas were not found in your organization');
    }
    await this.prisma.idea.updateMany({
      where: { id: { in: dto.ids } },
      data: { status: dto.status },
    });
    this.logger.log(`Bulk status update: ${ideas.length} ideas set to "${dto.status}" for org ${orgId}`);
    for (const row of ideas) {
      this.events.emitIdeaUpdated(orgId, {
        ideaId: row.id,
        siteId: row.siteId,
        status: dto.status,
      });
    }
    return { updated: ideas.length };
  }

  async getDetail(orgId: string, ideaId: string) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: {
        site: { select: { id: true, name: true, url: true, cms: true, orgId: true } },
        ideaSources: {
          include: {
            page: { select: { id: true, url: true, type: true, title: true } },
          },
        },
      },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.site.orgId !== orgId) throw new ForbiddenException();

    const displayHours = idea.customHours ?? idea.estimatedHours;

    return {
      id: idea.id,
      siteId: idea.siteId,
      siteName: idea.site.name,
      siteUrl: idea.site.url,
      cms: idea.site.cms,
      title: idea.title,
      pitchText: idea.pitchText,
      complexity: idea.complexity,
      estimatedHours: idea.estimatedHours,
      displayHours,
      customHours: idea.customHours,
      requiresDev: idea.requiresDev,
      areas: idea.areas,
      confidence: idea.confidence,
      impactScore: idea.impactScore,
      status: idea.status,
      cmsHint: idea.cmsHint,
      reasoning: idea.description,
      sourcePages: idea.ideaSources.map((s) => ({
        id: s.page.id,
        url: s.page.url,
        type: s.page.type,
        title: s.page.title,
      })),
      notes: idea.notes,
      generatedAt: idea.generatedAt,
    };
  }

  private buildWhereForSite(siteId: string, q: ListIdeasQueryDto): Prisma.IdeaWhereInput {
    const where: Prisma.IdeaWhereInput = { siteId };
    if (q.complexity) where.complexity = q.complexity as IdeaComplexity;
    if (q.status) where.status = q.status as IdeaStatus;
    if (q.requires_dev === 'true') where.requiresDev = true;
    if (q.requires_dev === 'false') where.requiresDev = false;
    if (q.area) where.areas = { has: q.area };
    return where;
  }

  private buildOrderBy(sort?: string): Prisma.IdeaOrderByWithRelationInput[] {
    switch (sort) {
      case 'effort':
        return [{ estimatedHours: 'desc' }, { generatedAt: 'desc' }];
      case 'created_at':
        return [{ generatedAt: 'desc' }];
      case 'impact':
      default:
        return [{ impactScore: 'desc' }, { confidence: 'desc' }, { generatedAt: 'desc' }];
    }
  }

  async patch(orgId: string, ideaId: string, dto: PatchIdeaDto) {
    const idea = await this.prisma.idea.findUnique({
      where: { id: ideaId },
      include: { site: { select: { orgId: true } } },
    });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.site.orgId !== orgId) throw new ForbiddenException();

    const data: Prisma.IdeaUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.customHours !== undefined) data.customHours = dto.customHours;

    const updated = await this.prisma.idea.update({
      where: { id: ideaId },
      data,
      select: {
        id: true,
        siteId: true,
        title: true,
        pitchText: true,
        cmsHint: true,
        complexity: true,
        estimatedHours: true,
        customHours: true,
        requiresDev: true,
        areas: true,
        confidence: true,
        impactScore: true,
        status: true,
        notes: true,
        generatedAt: true,
      },
    });

    this.logger.debug(`Idea ${ideaId} patched for org ${orgId} (status=${updated.status})`);
    this.events.emitIdeaUpdated(orgId, {
      ideaId: updated.id,
      siteId: updated.siteId,
      status: updated.status,
      customHours: updated.customHours,
    });

    return updated;
  }
}
