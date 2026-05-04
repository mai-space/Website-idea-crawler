import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventsGateway } from '../events/events.gateway';
import { CRAWL_QUEUE } from './crawl.constants';
import { PARSE_QUEUE } from './parse.constants';
import { IDEAS_QUEUE } from './ideas.constants';

@Injectable()
export class QueueStatsEmitter {
  constructor(
    @InjectQueue(CRAWL_QUEUE) private readonly crawlQueue: Queue,
    @InjectQueue(PARSE_QUEUE) private readonly parseQueue: Queue,
    @InjectQueue(IDEAS_QUEUE) private readonly ideasQueue: Queue,
    private readonly events: EventsGateway,
  ) {}

  async emitForOrg(orgId: string) {
    const [crawl, parse, ideas] = await Promise.all([
      this.crawlQueue.getWaitingCount(),
      this.parseQueue.getWaitingCount(),
      this.ideasQueue.getWaitingCount(),
    ]);
    this.events.emitQueueStats(orgId, {
      crawl,
      parse,
      ideas,
      workers: 10,
    });
  }
}
