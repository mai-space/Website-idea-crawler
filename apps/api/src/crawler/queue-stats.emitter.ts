import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsGateway } from '../events/events.gateway';
import { CRAWL_QUEUE } from './crawl.constants';
import { PARSE_QUEUE } from './parse.constants';

@Injectable()
export class QueueStatsEmitter {
  constructor(
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
    @InjectQueue(PARSE_QUEUE) private readonly parseQueue: Queue,
    private readonly events: EventsGateway,
  ) {}

  async emitForOrg(orgId: string) {
    const [crawl, parse] = await Promise.all([
      this.crawlQueue.getWaitingCount(),
      this.parseQueue.getWaitingCount(),
    ]);
    this.events.emitQueueStats(orgId, {
      crawl,
      parse,
      ideas: 0,
      workers: 8,
    });
  }
}
