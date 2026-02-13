import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db } from '@/lib/storage/database';

interface LeaveGroupInput {
  groupId: string;
}

export function useLeaveGroup() {
  const { marmotClient } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId }: LeaveGroupInput) => {
      if (!marmotClient) throw new Error('Not authenticated');

      // Destroy MLS state via marmot-ts (purges state + history)
      await marmotClient.destroyGroup(groupId);

      // Clean up local Dexie data
      await db.groups.delete(groupId);
      await db.messages.where({ groupId }).delete();
      await db.readState.delete(groupId);
      await db.syncMeta.delete('lastSync_' + groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storedGroups });
    },
  });
}
