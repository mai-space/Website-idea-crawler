import { Injectable, Logger } from '@nestjs/common';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly buckets = new Map<string, Bucket>();
  private readonly rps: number;

  constructor() {
    const raw = parseFloat(process.env.CRAWLER_RATE_LIMIT_RPS || '2');
    if (!Number.isFinite(raw) || raw <= 0) {
      this.logger.warn(`Invalid CRAWLER_RATE_LIMIT_RPS value "${process.env.CRAWLER_RATE_LIMIT_RPS}" — falling back to 2 RPS`);
      this.rps = 2;
    } else {
      this.rps = raw;
      this.logger.log(`Rate limiter initialised at ${this.rps} RPS per domain`);
    }
  }

  async acquire(domain: string): Promise<void> {
    const now = Date.now();
    let bucket = this.buckets.get(domain);

    if (!bucket) {
      bucket = { tokens: this.rps, lastRefill: now };
      this.buckets.set(domain, bucket);
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.rps, bucket.tokens + elapsed * this.rps);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    const waitMs = Math.ceil(((1 - bucket.tokens) / this.rps) * 1000);
    this.logger.debug(`Rate limiting ${domain} — waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    bucket.tokens = 0;
  }
}
