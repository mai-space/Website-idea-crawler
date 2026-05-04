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
