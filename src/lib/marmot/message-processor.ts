import type { Rumor } from 'applesauce-common/helpers/gift-wrap';
import { deserializeApplicationRumor } from 'marmot-ts';
import type { MarmotGroup } from 'marmot-ts';
import type { NostrEvent } from 'nostr-tools/pure';
import type { QueryClient } from '@tanstack/react-query';
import { db, type StoredMessage } from '@/lib/storage/database';
import { QUERY_KEYS } from '@/lib/relay/query-keys';

/**
 * Processes group events through MarmotGroup.ingest() and persists resulting messages.
 */
export async function processGroupEvents(
  group: MarmotGroup,
  events: NostrEvent[],
  queryClient: QueryClient,
): Promise<void> {
  if (events.length === 0) return;

  for await (const result of group.ingest(events)) {
    if (result.kind === 'applicationMessage') {
      let rumor: Rumor;
      try {
        rumor = deserializeApplicationRumor(result.message);
      } catch {
        continue;
      }

      const storedMessage: StoredMessage = {
        id: rumor.id ?? `${group.idStr}-${rumor.created_at}-${rumor.pubkey}`,
        groupId: group.idStr,
        senderPubkey: rumor.pubkey,
        content: rumor.content,
        createdAt: rumor.created_at,
        kind: rumor.kind,
      };

      await db.messages.put(storedMessage);

      // Update group's last message
      await db.groups.update(group.idStr, {
        lastMessage: storedMessage,
      });

      // Invalidate caches so UI updates
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(group.idStr) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storedGroups });
    }
  }
}
