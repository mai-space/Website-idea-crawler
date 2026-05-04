import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { CrawlProcessor } from './crawl.processor';
import { ParseProcessor } from './parse.processor';
import { RateLimiterService } from './rate-limiter.service';
import { QueueStatsEmitter } from './queue-stats.emitter';
import { EventsModule } from '../events/events.module';
import { CRAWL_QUEUE } from './crawl.constants';
import { PARSE_QUEUE } from './parse.constants';

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
    BullModule.registerQueue({ name: CRAWL_QUEUE }, { name: PARSE_QUEUE }),
    EventsModule,
  ],
  providers: [CrawlerService, CrawlProcessor, ParseProcessor, RateLimiterService, QueueStatsEmitter],
  controllers: [CrawlerController],
  exports: [CrawlerService],
})
export class CrawlerModule {}
