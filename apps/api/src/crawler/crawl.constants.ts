export const CRAWL_QUEUE = 'crawl-queue';

export interface CrawlPageJob {
  siteId: string;
  crawlJobId: string;
  orgId: string;
  url: string;
  depth: number;
  maxDepth: number;
  visitedUrls: string[];
}
