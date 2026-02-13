import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import type { MarmotGroup } from 'marmot-ts';

export function useGroups() {
  const { marmotClient } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEYS.groups,
    queryFn: async (): Promise<MarmotGroup[]> => {
      if (!marmotClient) return [];
      return marmotClient.loadAllGroups();
    },
    enabled: !!marmotClient,
  });

  // Listen for group changes and invalidate the cache
  useEffect(() => {
    if (!marmotClient) return;

    const handlers = {
      groupCreated: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
      groupJoined: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
      groupsUpdated: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
      groupUnloaded: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
      groupDestroyed: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups }),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      marmotClient.on(event as keyof typeof handlers, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        marmotClient.off(event as keyof typeof handlers, handler);
      }
    };
  }, [marmotClient, queryClient]);

  return query;
}
