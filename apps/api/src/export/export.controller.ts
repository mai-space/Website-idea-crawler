import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExportService } from './export.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async exportOrg(
    @Request() req: AuthedRequest,
    @Query('format') format: string,
    @Query('site_id') siteId?: string,
    @Query('status') status?: string,
    @Query('complexity') complexity?: string,
    @Query('limit') limitStr?: string,
  ) {
    const fmt = (format || 'json').toLowerCase();
    if (fmt !== 'json' && fmt !== 'csv') {
      throw new BadRequestException('format must be json or csv (PDF via client export)');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const filters = {
      siteId,
      status: status as never,
      complexity: complexity as never,
      limit: Number.isFinite(limit) ? limit : undefined,
    };
    if (siteId) {
      const ok = await this.prisma.site.findFirst({ where: { id: siteId, orgId: req.user.orgId } });
      if (!ok) throw new BadRequestException('Invalid site_id');
    }
    if (fmt === 'json') {
      return this.exportService.exportIdeasJson(req.user.orgId, filters);
    }
    const csv = await this.exportService.exportIdeasCsv(req.user.orgId, filters);
    return { format: 'csv', content: csv };
  }
}
