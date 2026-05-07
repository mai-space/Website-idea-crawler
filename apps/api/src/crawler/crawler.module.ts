import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { CrawlProcessor } from './crawl.processor';
import { ParseProcessor } from './parse.processor';
import { RateLimiterService } from './rate-limiter.service';
import { QueueStatsEmitter } from './queue-stats.emitter';
import { EventsModule } from '../events/events.module';
import { ExportModule } from '../export/export.module';
import { CRAWL_QUEUE } from './crawl.constants';
import { PARSE_QUEUE } from './parse.constants';
import { IDEAS_QUEUE } from './ideas.constants';
import { IdeasProcessor } from './ideas.processor';
import { IdeasService } from './ideas.service';
import { IdeasController } from './ideas.controller';
import { CrawlSchedulerService } from './crawl-scheduler.service';
import { NotifierService } from '../notifications/notifier.service';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      }),
    }),
    BullModule.registerQueue({ name: CRAWL_QUEUE }, { name: PARSE_QUEUE }, { name: IDEAS_QUEUE }),
    EventsModule,
    ExportModule,
  ],
  providers: [
    CrawlerService,
    CrawlProcessor,
    ParseProcessor,
    IdeasProcessor,
    IdeasService,
    CrawlSchedulerService,
    NotifierService,
    RateLimiterService,
    QueueStatsEmitter,
    SitemapService,
  ],
  controllers: [CrawlerController, IdeasController],
  exports: [CrawlerService, IdeasService],
})
export class CrawlerModule {}
