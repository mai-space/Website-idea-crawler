import * as cheerio from 'cheerio';

export const MAX_RAW_HTML_CHARS = 1_500_000;

export function truncateRawHtml(html: string): string {
  if (html.length <= MAX_RAW_HTML_CHARS) return html;
  return html.slice(0, MAX_RAW_HTML_CHARS);
}

export interface ExtractedMeta {
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  h1: string | null;
  canonical: string | null;
}

export function extractFromHtml(html: string): { $: cheerio.CheerioAPI; meta: ExtractedMeta } {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
  const title =
    $('title').first().text().trim()
    || ogTitle
    || $('h1').first().text().trim()
    || null;
  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  const h1 = $('h1').first().text().trim() || null;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;
  return {
    $,
    meta: { title, description, ogTitle, h1, canonical },
  };
}

const CLASS_NOISE = /\b(menu|sidebar|cookie|banner|footer-nav|header-nav|navigation)\b/i;

export function cleanForMainText($: cheerio.CheerioAPI): cheerio.CheerioAPI {
  const root = cheerio.load($.root().html() ?? '');
  root('nav, header, footer, aside, script, style, noscript').remove();
  root('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  root('*').each((_, el) => {
    const node = root(el);
    const cls = node.attr('class') || '';
    const id = node.attr('id') || '';
    if (CLASS_NOISE.test(cls) || CLASS_NOISE.test(id)) node.remove();
  });

  return root;
}

export function mainBodyText(cleaned: cheerio.CheerioAPI): string {
  const main = cleaned('main, article, [role="main"]').first();
  const scope = main.length ? main : cleaned('body');
  const text = scope.text().replace(/\s+/g, ' ').trim();
  return text;
}

export function wordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
