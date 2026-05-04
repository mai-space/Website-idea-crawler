import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type { PageType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrawlerService, StartCrawlDto } from './crawler.service';
import { IdeasService } from './ideas.service';
import { ListIdeasQueryDto } from './dto/list-ideas-query.dto';

const PAGE_TYPES: PageType[] = ['landing', 'blog', 'product', 'docs', 'other'];

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId')
export class CrawlerController {
  constructor(
    private readonly crawler: CrawlerService,
    private readonly ideas: IdeasService,
  ) {}

  @Post('crawl')
  startCrawl(
    @Request() req: AuthedRequest,
    @Param('siteId') siteId: string,
    @Body() dto: StartCrawlDto,
  ) {
    return this.crawler.startCrawl(req.user.orgId, siteId, dto);
  }

  @Delete('crawl')
  stopCrawl(@Request() req: AuthedRequest, @Param('siteId') siteId: string) {
    return this.crawler.stopCrawl(req.user.orgId, siteId);
  }

  @Get('crawl/status')
  getStatus(@Request() req: AuthedRequest, @Param('siteId') siteId: string) {
    return this.crawler.getStatus(req.user.orgId, siteId);
  }

  @Get('pages')
  getPages(
    @Request() req: AuthedRequest,
    @Param('siteId') siteId: string,
    @Query('type') type?: string,
  ) {
    if (type && !PAGE_TYPES.includes(type as PageType)) {
      throw new BadRequestException('Invalid type filter');
    }
    return this.crawler.getPages(req.user.orgId, siteId, type as PageType | undefined);
  }

  @Post('ideas/generate')
  generateIdeas(@Request() req: AuthedRequest, @Param('siteId') siteId: string) {
    return this.ideas.enqueueGenerate(req.user.orgId, siteId);
  }

  @Get('ideas')
  listSiteIdeas(
    @Request() req: AuthedRequest,
    @Param('siteId') siteId: string,
    @Query() q: ListIdeasQueryDto,
  ) {
    return this.ideas.listForSite(req.user.orgId, siteId, q);
  }
}
