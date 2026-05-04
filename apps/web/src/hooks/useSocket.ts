import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useSocketStore } from '@/store';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();
  const { setConnected, setQueueStats, setSocket, pushCrawlPageActivity } = useSocketStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.orgId) return;

    const socket = io('/', {
      query: { orgId: user.orgId },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocket(socket);
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setSocket(null);
    });

    socket.on('queue.stats', setQueueStats);

    socket.on('job.update', ({ siteId }: { siteId: string; status: string; progress: number }) => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', siteId] });
    });

    socket.on('crawl.page', (payload: { siteId: string; url: string; pageType: string }) => {
      pushCrawlPageActivity({
        siteId: payload.siteId,
        url: payload.url,
        pageType: payload.pageType,
      });
      queryClient.invalidateQueries({ queryKey: ['site', payload.siteId, 'pages'] });
    });

    socket.on('idea.new', (payload: { siteId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ideas'] });
      queryClient.invalidateQueries({ queryKey: ['site', payload.siteId, 'ideas'] });
      queryClient.invalidateQueries({ queryKey: ['idea'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    });

    return () => {
      socket.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [user?.orgId, setConnected, setQueueStats, setSocket, pushCrawlPageActivity, queryClient]);

  return socketRef;
}
