import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getEventHash } from 'nostr-tools/pure';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db, type StoredMessage } from '@/lib/storage/database';
import type { MarmotGroup } from 'marmot-ts';
import type { Rumor } from 'applesauce-common/helpers/gift-wrap';

interface SendMessageInput {
  group: MarmotGroup;
  content: string;
}

export function useSendMessage() {
  const { marmotClient, pubkey } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ group, content }: SendMessageInput) => {
      if (!marmotClient || !pubkey) {
        throw new Error('Not authenticated');
      }

      const now = Math.floor(Date.now() / 1000);

      // Create unsigned kind:9 rumor for MIP-03
      // Must have a proper event hash ID for deserialization to work
      const rumorBase = {
        kind: 9,
        content,
        tags: [],
        pubkey,
        created_at: now,
        id: '',
      };
      rumorBase.id = getEventHash(rumorBase);
      const rumor = rumorBase as unknown as Rumor;

      // Optimistic update
      const optimisticMessage: StoredMessage = {
        id: rumorBase.id,
        groupId: group.idStr,
        senderPubkey: pubkey,
        content,
        createdAt: now,
        kind: 9,
      };

      queryClient.setQueryData<StoredMessage[]>(
        QUERY_KEYS.messages(group.idStr),
        (old) => [...(old ?? []), optimisticMessage],
      );

      // Send through MLS
      await group.sendApplicationRumor(rumor);

      // Persist to Dexie
      await db.messages.put(optimisticMessage);

      // Update group's last message
      await db.groups.update(group.idStr, {
        lastMessage: optimisticMessage,
      });

      return optimisticMessage;
    },
    onSuccess: (_data, { group }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      // Mark as read after sending
      db.readState.put({
        groupId: group.idStr,
        lastReadAt: Math.floor(Date.now() / 1000),
      }).catch(console.error);
    },
    onError: (_err, { group }) => {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(group.idStr) });
    },
  });
}
