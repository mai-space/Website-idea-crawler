import * as cheerio from 'cheerio';
import type { PageType } from '@prisma/client';

export function classifyPageFromCrawl(url: string, $: cheerio.CheerioAPI): PageType {
  return classifyPageCore(new URL(url).pathname.toLowerCase(), {
    h1: $('h1').first().text().toLowerCase(),
    bodySample: '',
  });
}

export function classifyPageAfterParse(
  url: string,
  $: cheerio.CheerioAPI,
  bodyText: string,
): PageType {
  const path = new URL(url).pathname.toLowerCase();
  const sample = bodyText.slice(0, 4000).toLowerCase();
  return classifyPageCore(path, {
    h1: $('h1').first().text().toLowerCase(),
    bodySample: sample,
  });
}

function classifyPageCore(
  path: string,
  ctx: { h1: string; bodySample: string },
): PageType {
  const { h1, bodySample } = ctx;
  const blob = `${path} ${h1} ${bodySample}`;

  if (path === '/' || path === '') return 'landing';

  if (/\/(blog|news|artikel|beitrag|magazin|stories)/.test(path)) return 'blog';
  if (/\/(produkt|product|shop|leistung|service|pricing|preise|warenkorb)/.test(path)) return 'product';
  if (/\/(docs|documentation|hilfe|help|wiki|api|reference|guide|handbuch)/.test(path)) return 'docs';

  if (/\b(blog|news|artikel|magazin)\b/.test(h1) || /\b(blog|newsletter|artikel)\b/.test(bodySample.slice(0, 800)))
    return 'blog';
  if (/\b(produkt|product|pricing|preis|buy|kaufen|warenkorb|demo)\b/.test(h1) || /\b(eur|usd|\$\s*\d|ab\s*\d+\s*€)\b/.test(bodySample))
    return 'product';
  if (/\b(dokumentation|documentation|api reference|getting started|installation|changelog)\b/.test(blob))
    return 'docs';

  if (/\b(willkommen|welcome to|we help|wir sind|über uns|about us)\b/.test(bodySample.slice(0, 1200)) && path.split('/').filter(Boolean).length <= 1)
    return 'landing';

  return 'other';
}
