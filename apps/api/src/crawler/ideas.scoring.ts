import type { CmsType } from '@prisma/client';

export type IdeaKind =
  | 'blog'
  | 'blog_post'
  | 'seo_fix'
  | 'new_section'
  | 'api_integration'
  | 'feature'
  | 'other';

export function normalizeIdeaKind(raw: string | undefined): IdeaKind {
  const v = (raw || 'other').toLowerCase().trim();
  if (v === 'blog') return 'blog_post';
  if (['blog_post', 'seo_fix', 'new_section', 'api_integration', 'feature', 'other'].includes(v)) {
    return v as IdeaKind;
  }
  return 'other';
}

/** Stufe 1 — regelbasierte Defaults vor AI-Validierung */
export function baseScore(
  kind: IdeaKind,
  cms: CmsType,
): { complexity: 'low' | 'medium' | 'high'; hours: number; requiresDev: boolean } {
  if (kind === 'blog_post') return { complexity: 'low', hours: 4, requiresDev: false };
  if (kind === 'seo_fix') return { complexity: 'low', hours: 8, requiresDev: false };
  if (kind === 'new_section') return { complexity: 'medium', hours: 16, requiresDev: false };
  if (kind === 'api_integration') return { complexity: 'high', hours: 40, requiresDev: true };
  if (kind === 'feature') return { complexity: 'medium', hours: 24, requiresDev: true };

  if (cms === 'typo3') {
    return { complexity: 'medium', hours: 12, requiresDev: false };
  }
  if (cms === 'wordpress') {
    return { complexity: 'low', hours: 8, requiresDev: false };
  }
  return { complexity: 'medium', hours: 14, requiresDev: false };
}
