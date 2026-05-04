import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sb_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface Site {
  id: string;
  name: string;
  url: string;
  cms: 'typo3' | 'wordpress' | 'generic';
  priority: number;
  status: 'idle' | 'crawling' | 'analyzing' | 'error';
  healthScore: number | null;
  createdAt: string;
  updatedAt: string;
  _count: { ideas: number; pages: number };
  crawlJobs: CrawlJob[];
}

export type PageType = 'landing' | 'blog' | 'product' | 'docs' | 'other';

export interface CrawlJob {
  id: string;
  siteId: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'stopped';
  pagesTotal: number;
  pagesCrawled: number;
  startedAt: string | null;
  finishedAt: string | null;
  errors?: unknown[];
}

export interface PageRow {
  id: string;
  siteId: string;
  crawlJobId: string;
  url: string;
  type: PageType;
  title: string | null;
  contentHash: string | null;
  parsedAt: string | null;
  meta: Record<string, unknown> | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
}

export type IdeaComplexity = 'low' | 'medium' | 'high';
export type IdeaStatus = 'open' | 'accepted' | 'rejected' | 'deferred' | 'done';

export interface IdeaListSite {
  id: string;
  name: string;
  url: string;
}

export interface IdeaBriefRow {
  id: string;
  siteId: string;
  title: string;
  pitchText: string;
  cmsHint?: string | null;
  complexity: IdeaComplexity;
  estimatedHours: number;
  customHours: number | null;
  requiresDev: boolean;
  areas: string[];
  confidence: number;
  impactScore: number;
  status: IdeaStatus;
  generatedAt: string;
  site?: IdeaListSite;
}

export interface PaginatedIdeas {
  items: IdeaBriefRow[];
  total: number;
  page: number;
  limit: number;
}

export interface IdeaSourcePage {
  id: string;
  url: string;
  type: PageType;
  title: string | null;
}

export interface IdeaDetail {
  id: string;
  siteId: string;
  siteName: string;
  siteUrl: string;
  cms: Site['cms'];
  title: string;
  pitchText: string;
  complexity: IdeaComplexity;
  estimatedHours: number;
  displayHours: number;
  customHours: number | null;
  requiresDev: boolean;
  areas: string[];
  confidence: number;
  impactScore: number;
  status: IdeaStatus;
  cmsHint: string | null;
  reasoning: string | null;
  sourcePages: IdeaSourcePage[];
  notes: string | null;
  generatedAt: string;
}
