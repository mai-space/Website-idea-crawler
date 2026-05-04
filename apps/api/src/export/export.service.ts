import { Injectable } from '@nestjs/common';
import type { IdeaComplexity, IdeaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ExportIdeaFilters {
  siteId?: string;
  status?: IdeaStatus;
  complexity?: IdeaComplexity;
  limit?: number;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(orgId: string, f: ExportIdeaFilters): Prisma.IdeaWhereInput {
    const where: Prisma.IdeaWhereInput = { site: { orgId } };
    if (f.siteId) where.siteId = f.siteId;
    if (f.status) where.status = f.status;
    if (f.complexity) where.complexity = f.complexity;
    return where;
  }

  async exportIdeasJson(orgId: string, f: ExportIdeaFilters) {
    const limit = Math.min(f.limit ?? 2000, 5000);
    const where = this.buildWhere(orgId, f);
    return this.prisma.idea.findMany({
      where,
      take: limit,
      orderBy: [{ generatedAt: 'desc' }],
      include: {
        site: { select: { id: true, name: true, url: true } },
        ideaSources: { include: { page: { select: { url: true, type: true } } } },
      },
    });
  }

  async exportIdeasCsv(orgId: string, f: ExportIdeaFilters): Promise<string> {
    const rows = await this.exportIdeasJson(orgId, f);
    const header = [
      'id',
      'siteId',
      'siteName',
      'title',
      'pitchText',
      'complexity',
      'estimatedHours',
      'customHours',
      'status',
      'impactScore',
      'confidence',
      'areas',
      'generatedAt',
    ].join(',');
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = rows.map((r) =>
      [
        r.id,
        r.siteId,
        r.site.name,
        r.title,
        r.pitchText,
        r.complexity,
        r.estimatedHours,
        r.customHours ?? '',
        r.status,
        r.impactScore,
        r.confidence,
        r.areas.join('|'),
        r.generatedAt.toISOString(),
      ]
        .map(esc)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }
}
