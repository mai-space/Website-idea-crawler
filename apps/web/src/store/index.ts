import { create } from 'zustand';
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

interface SocketState {
  connected: boolean;
  queueStats: QueueStats;
  setConnected: (v: boolean) => void;
  setQueueStats: (s: QueueStats) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  connected: false,
  queueStats: { crawl: 0, parse: 0, ideas: 0, workers: 0 },
  setConnected: (connected) => set({ connected }),
  setQueueStats: (queueStats) => set({ queueStats }),
}));
