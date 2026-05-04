import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useSocketStore } from '@/store';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();
  const { setConnected, setQueueStats } = useSocketStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.orgId) return;

    const socket = io('/', {
      query: { orgId: user.orgId },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('queue.stats', setQueueStats);

    socket.on('job.update', ({ siteId }: { siteId: string; status: string; progress: number }) => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
    });

    socket.on('crawl.page', ({ siteId }: { siteId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId, 'pages'] });
    });

    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [user?.orgId, setConnected, setQueueStats, queryClient]);

  return socketRef;
}
