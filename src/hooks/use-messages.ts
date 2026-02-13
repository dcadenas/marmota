import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db, type StoredMessage } from '@/lib/storage/database';

export function useMessages(groupId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.messages(groupId ?? ''),
    queryFn: async (): Promise<StoredMessage[]> => {
      if (!groupId) return [];
      return db.messages.where('groupId').equals(groupId).sortBy('createdAt');
    },
    enabled: !!groupId,
  });
}
