import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { db } from '@/lib/storage/database';
import { DEFAULT_MLS_RELAYS } from '@/lib/relay/defaults';
import type { MarmotGroup } from 'marmot-ts';

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;

/** Convert npub to hex pubkey, or return as-is if already hex. Validates format. */
function toHexPubkey(input: string): string {
  if (input.startsWith('npub1')) {
    const decoded = nip19.decode(input);
    if (decoded.type !== 'npub') throw new Error('Invalid npub');
    return decoded.data;
  }
  if (!HEX_PUBKEY_RE.test(input)) {
    throw new Error('Invalid pubkey format. Expected 64-char hex or npub.');
  }
  return input;
}

interface CreateGroupInput {
  name: string;
  description?: string;
  members?: string[];
}

export interface CreateGroupResult {
  group: MarmotGroup;
  failedInvites: string[];
}

export function useCreateGroup() {
  const { marmotClient, pubkey } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, members }: CreateGroupInput): Promise<CreateGroupResult> => {
      if (!marmotClient || !pubkey) {
        throw new Error('Not authenticated');
      }

      const group = await marmotClient.createGroup(name, {
        description,
        adminPubkeys: [pubkey],
        relays: DEFAULT_MLS_RELAYS,
      });

      const groupData = group.groupData;

      // Persist group metadata to Dexie
      await db.groups.put({
        id: group.idStr,
        name: groupData?.name ?? name,
        description: groupData?.description,
        members: [pubkey],
        messageCount: 0,
        createdAt: Math.floor(Date.now() / 1000),
        nostrGroupId: groupData?.nostrGroupId
          ? Array.from(groupData.nostrGroupId)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
          : undefined,
      });

      const failedInvites: string[] = [];

      // If initial members were specified, invite them after creation
      if (members && members.length > 0) {
        // Deduplicate and filter out self
        const seen = new Set<string>();
        const uniqueMembers = members
          .map((raw) => toHexPubkey(raw))
          .filter((hex) => hex !== pubkey && !seen.has(hex) && (seen.add(hex), true));

        for (const memberPubkey of uniqueMembers) {
          try {
            const inboxRelays =
              await marmotClient.network.getUserInboxRelays(memberPubkey);
            const events = await marmotClient.network.request(
              [...new Set([...inboxRelays, ...DEFAULT_MLS_RELAYS])],
              [{ kinds: [443], authors: [memberPubkey], limit: 1 }],
            );
            if (events.length === 0) {
              failedInvites.push(memberPubkey);
              continue;
            }
            await group.inviteByKeyPackageEvent(events[0]!);
          } catch (err) {
            console.error(`Failed to invite ${memberPubkey}:`, err);
            failedInvites.push(memberPubkey);
          }
        }
      }

      return { group, failedInvites };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
    },
  });
}
