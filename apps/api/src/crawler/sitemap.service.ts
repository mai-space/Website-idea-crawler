import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { gunzipSync } from 'node:zlib';

const USER_AGENT = 'Sitebrief/2.0 (+https://sitebrief.dev)';
const MAX_SITEMAP_DEPTH = 2;
const MAX_URLS_PER_SITEMAP = 5000;
const SKIPPED_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|gz|css|js|woff2?)(\?|$)/i;

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);
  private readonly timeoutMs = parseInt(process.env.CRAWLER_TIMEOUT_MS || '10000');

  /** Return all page URLs discoverable via sitemap for the given site origin. */
  async discoverUrls(siteUrl: string, maxUrls: number): Promise<string[]> {
    let origin: string;
    try {
      origin = new URL(siteUrl).origin;
    } catch {
      return [];
    }

    const candidates = await this.findSitemapCandidates(origin);
    const seen = new Set<string>();

    for (const candidate of candidates.slice(0, 5)) {
      const urls = await this.parseSitemap(candidate, origin, 0, maxUrls);
      for (const u of urls) {
        seen.add(u);
        if (seen.size >= maxUrls) break;
      }
      if (seen.size >= maxUrls) break;
    }

    if (seen.size > 0) {
      this.logger.log(`Sitemap discovery found ${seen.size} URLs for ${origin}`);
    }
    return [...seen];
  }

  /** Probe robots.txt, then fall back to well-known sitemap paths. */
  private async findSitemapCandidates(origin: string): Promise<string[]> {
    const fromRobots = await this.sitemapsFromRobots(origin);
    if (fromRobots.length > 0) return fromRobots;

    return [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
    ];
  }

  private async sitemapsFromRobots(origin: string): Promise<string[]> {
    try {
      const { data } = await axios.get<string>(`${origin}/robots.txt`, {
        timeout: this.timeoutMs,
        headers: { 'User-Agent': USER_AGENT },
      });
      return (data as string)
        .split(/\r?\n/)
        .filter((l) => /^sitemap\s*:/i.test(l))
        .map((l) => l.replace(/^sitemap\s*:\s*/i, '').trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private async parseSitemap(url: string, origin: string, depth: number, maxUrls: number): Promise<string[]> {
    if (depth > MAX_SITEMAP_DEPTH) return [];

    let xml: string;
    try {
      const { data, headers } = await axios.get<ArrayBuffer>(url, {
        timeout: this.timeoutMs,
        headers: { 'User-Agent': USER_AGENT },
        responseType: 'arraybuffer',
      });
      const contentType = String(headers['content-type'] ?? '').toLowerCase();
      const contentEncoding = String(headers['content-encoding'] ?? '').toLowerCase();
      const gzipped =
        url.toLowerCase().endsWith('.gz') ||
        contentType.includes('application/gzip') ||
        contentType.includes('application/x-gzip') ||
        contentEncoding.includes('gzip');
      const body = Buffer.from(data);
      xml = gzipped ? gunzipSync(body).toString('utf8') : body.toString('utf8');
    } catch (err: unknown) {
      this.logger.debug(`Sitemap fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }

    const $ = cheerio.load(xml, { xmlMode: true });

    // Sitemap index — contains <sitemap><loc>…</loc></sitemap> entries
    const childSitemaps: string[] = [];
    $('sitemap > loc').each((_, el) => {
      childSitemaps.push($(el).text().trim());
    });

    if (childSitemaps.length > 0) {
      const urls: string[] = [];
      for (const child of childSitemaps.slice(0, 20)) {
        const sub = await this.parseSitemap(child, origin, depth + 1, maxUrls);
        urls.push(...sub);
        if (urls.length >= maxUrls) break;
      }
      return urls.slice(0, maxUrls);
    }

    // Regular sitemap — contains <url><loc>…</loc></url> entries
    const urls: string[] = [];
    for (const el of $('url > loc').toArray()) {
      if (urls.length >= maxUrls) break;
      const loc = $(el).text().trim();
      if (!loc) continue;
      if (SKIPPED_EXTENSIONS.test(loc)) continue;
      try {
        const u = new URL(loc);
        if (u.origin === origin) urls.push(loc);
      } catch {}
    }
    return urls.slice(0, maxUrls);
  }
}
