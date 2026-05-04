import type { PageType } from '@/api/client';

const STROKE = 'currentColor';

export function PageTypeIcon({ type, size = 16 }: { type: PageType; size?: number }) {
  switch (type) {
    case 'landing':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.75" aria-hidden>
          <path d="M3 10.5L12 3l9 7.5V21H3V10.5z" strokeLinejoin="round" />
          <path d="M9 21V12h6v9" strokeLinejoin="round" />
        </svg>
      );
    case 'blog':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.75" aria-hidden>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinejoin="round" />
          <path d="M8 7h8M8 11h8" strokeLinecap="round" />
        </svg>
      );
    case 'product':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.75" aria-hidden>
          <rect x="3" y="7" width="18" height="14" rx="2" strokeLinejoin="round" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
        </svg>
      );
    case 'docs':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
          <path d="M14 2v6h6M10 13h4M10 17h4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={STROKE} strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" strokeLinecap="round" />
        </svg>
      );
  }
}
