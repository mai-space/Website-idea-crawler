import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { AuthUser } from '@/api/client';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('sb_token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('sb_token', token);
    set({ token, user });
  },
  clearAuth: () => {
    localStorage.removeItem('sb_token');
    set({ token: null, user: null });
  },
}));

interface QueueStats {
  crawl: number;
  parse: number;
  ideas: number;
  workers: number;
}

export interface CrawlPageActivity {
  siteId: string;
  url: string;
  pageType: string;
  at: number;
}

interface SocketState {
  connected: boolean;
  socket: Socket | null;
  queueStats: QueueStats;
  crawlPageActivity: CrawlPageActivity[];
  setConnected: (v: boolean) => void;
  setSocket: (s: Socket | null) => void;
  setQueueStats: (s: QueueStats) => void;
  pushCrawlPageActivity: (e: Omit<CrawlPageActivity, 'at'>) => void;
}

const MAX_ACTIVITY = 200;

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  socket: null,
  queueStats: { crawl: 0, parse: 0, ideas: 0, workers: 0 },
  crawlPageActivity: [],
  setConnected: (connected) => set({ connected }),
  setSocket: (socket) => set({ socket }),
  setQueueStats: (queueStats) => set({ queueStats }),
  pushCrawlPageActivity: (e) =>
    set((s) => ({
      crawlPageActivity: [{ ...e, at: Date.now() }, ...s.crawlPageActivity].slice(0, MAX_ACTIVITY),
    })),
}));
