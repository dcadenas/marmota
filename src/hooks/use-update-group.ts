import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MarmotGroup } from 'marmot-ts';
import { Proposals } from 'marmot-ts';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db } from '@/lib/storage/database';

interface UpdateGroupInput {
  group: MarmotGroup;
  name?: string;
  description?: string;
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ group, name, description }: UpdateGroupInput) => {
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;

      await group.commit({
        extraProposals: [Proposals.proposeUpdateMetadata(updates)],
      });

      // Update local Dexie store
      await db.groups.update(group.idStr, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storedGroups });
    },
  });
}
