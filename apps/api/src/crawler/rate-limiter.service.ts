import { Injectable } from '@nestjs/common';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

@Injectable()
export class RateLimiterService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly rps: number;

  constructor() {
    this.rps = parseFloat(process.env.CRAWLER_RATE_LIMIT_RPS || '2');
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

    const waitMs = ((1 - bucket.tokens) / this.rps) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    bucket.tokens = 0;
  }
}
