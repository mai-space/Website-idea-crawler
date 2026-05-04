import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { CrawlProcessor, CRAWL_QUEUE } from './crawl.processor';
import { RateLimiterService } from './rate-limiter.service';
import { EventsModule } from '../events/events.module';

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
    BullModule.registerQueue({ name: CRAWL_QUEUE }),
    EventsModule,
  ],
  providers: [CrawlerService, CrawlProcessor, RateLimiterService],
  controllers: [CrawlerController],
  exports: [CrawlerService],
})
export class CrawlerModule {}
