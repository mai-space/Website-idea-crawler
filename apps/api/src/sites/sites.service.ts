import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
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

  create(orgId: string, dto: CreateSiteDto) {
    return this.prisma.site.create({
      data: { orgId, ...dto },
    });
  }

  async update(orgId: string, id: string, dto: UpdateSiteDto) {
    await this.assertOwnership(orgId, id);
    return this.prisma.site.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    await this.assertOwnership(orgId, id);
    return this.prisma.site.delete({ where: { id } });
  }

  private async assertOwnership(orgId: string, id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.orgId !== orgId) throw new ForbiddenException();
    return site;
  }
}
