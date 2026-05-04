import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CrawlerService, StartCrawlDto } from './crawler.service';

interface AuthedRequest {
  user: { userId: string; orgId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('sites/:siteId')
export class CrawlerController {
  constructor(private readonly crawler: CrawlerService) {}

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
  getPages(@Request() req: AuthedRequest, @Param('siteId') siteId: string) {
    return this.crawler.getPages(req.user.orgId, siteId);
  }
}
