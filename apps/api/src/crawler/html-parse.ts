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

// Structural noise: layout chrome, third-party widgets, consent layers, etc.
const STRUCTURAL_SELECTORS = [
  'nav', 'header', 'footer', 'aside',
  'script', 'style', 'noscript', 'template',
  'svg', 'canvas', 'picture > source',
].join(', ');

const ARIA_NOISE_ROLES = new Set([
  'navigation', 'banner', 'contentinfo', 'complementary',
  'search', 'dialog', 'alertdialog',
]);

// Class / id fragments that reliably indicate non-content regions
const CLASS_NOISE =
  /\b(menu|sidebar|cookie|banner|footer-nav|header-nav|navigation|breadcrumb|topbar|toolbar|widget|popup|modal|overlay|chat|intercom|drift|hubspot|livechat|gdpr|consent|newsletter-modal|skip-link|back-to-top|social-share|sharing|pagination|pager|related-posts|tag-cloud|author-bio|comment-form|comments-area)\b/i;

export function cleanForMainText($: cheerio.CheerioAPI): cheerio.CheerioAPI {
  const root = cheerio.load($.root().html() ?? '');

  // Remove structural noise
  root(STRUCTURAL_SELECTORS).remove();
  root(`[role]`).each((_, el) => {
    const role = root(el).attr('role') || '';
    if (ARIA_NOISE_ROLES.has(role)) root(el).remove();
  });

  // Remove class/id-based noise
  root('*').each((_, el) => {
    const node = root(el);
    const cls = (node.attr('class') || '') + ' ' + (node.attr('id') || '');
    if (CLASS_NOISE.test(cls)) node.remove();
  });

  // Remove hidden elements that may carry invisible text
  root('[style*="display:none"], [style*="display: none"], [hidden]').remove();
  root('[aria-hidden="true"]').remove();

  return root;
}

export function mainBodyText(cleaned: cheerio.CheerioAPI): string {
  const main = cleaned('main, article, [role="main"], .content, .post-content, .entry-content, #content').first();
  const scope = main.length ? main : cleaned('body');
  return scope
    .text()
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Pages with fewer words than this threshold carry little AI signal. */
export const MIN_MEANINGFUL_WORDS = 80;

export function isPageMeaningful(text: string): boolean {
  return wordCount(text) >= MIN_MEANINGFUL_WORDS;
}
