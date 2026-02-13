import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { readStateStore } from '@/lib/storage/singleton';
import type { ReadStateMap } from '@/lib/storage/read-state-store';
import type { StoredGroup } from '@/lib/storage/database';

export function useReadState() {
  const { pubkey } = useAuth();
  const queryClient = useQueryClient();

  const { data: readState = {} } = useQuery<ReadStateMap>({
    queryKey: QUERY_KEYS.readState,
    queryFn: () => readStateStore.getAll(),
    staleTime: Infinity,
  });

  const markRead = useCallback(
    (groupId: string, timestamp: number) => {
      queryClient.setQueryData<ReadStateMap>(QUERY_KEYS.readState, (prev = {}) => {
        if (timestamp <= (prev[groupId] ?? 0)) return prev;
        return { ...prev, [groupId]: timestamp };
      });
      void readStateStore.markRead(groupId, timestamp);
    },
    [queryClient],
  );

  const isGroupUnread = useCallback(
    (group: StoredGroup) => {
      if (!pubkey) return false;
      if (!group.lastMessage) return false;
      if (group.lastMessage.senderPubkey === pubkey) return false;
      return group.lastMessage.createdAt > (readState[group.id] ?? 0);
    },
    [pubkey, readState],
  );

  const unreadCount = useMemo(() => {
    // Check stored groups from Dexie (via query cache) for unread state
    const storedGroups = queryClient.getQueryData<StoredGroup[]>(QUERY_KEYS.groups);
    if (!storedGroups) return 0;
    return storedGroups.filter((g) => isGroupUnread(g)).length;
  }, [queryClient, isGroupUnread, readState]);

  return { readState, markRead, isGroupUnread, unreadCount };
}
