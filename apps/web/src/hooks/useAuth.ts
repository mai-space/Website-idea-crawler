import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { api } from '@/api/client';
import type { AuthUser } from '@/api/client';

export function useAuth() {
  const { token, user, setAuth, clearAuth } = useAuthStore();

  const { data, isLoading } = useQuery<AuthUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then((r) => r.data),
    enabled: !!token && !user,
    retry: false,
  });

  useEffect(() => {
    if (data && token) setAuth(token, data);
  }, [data, token, setAuth]);

  return { isAuthenticated: !!token, user: user ?? data, isLoading: !!token && isLoading, clearAuth };
}
