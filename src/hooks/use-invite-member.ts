import { useMutation, useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { useAuth } from '@/context/auth-context';
import { QUERY_KEYS } from '@/lib/relay/query-keys';
import { DEFAULT_MLS_RELAYS } from '@/lib/relay/defaults';
import type { MarmotGroup } from 'marmot-ts';

interface InviteMemberInput {
  group: MarmotGroup;
  memberPubkey: string;
}

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

export function useInviteMember() {
  const { marmotClient, pubkey } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ group, memberPubkey: rawPubkey }: InviteMemberInput) => {
      if (!marmotClient || !pubkey) {
        throw new Error('Not authenticated');
      }

      const memberPubkey = toHexPubkey(rawPubkey);

      if (memberPubkey === pubkey) {
        throw new Error('Cannot invite yourself');
      }

      // Fetch the target's key package (kind:443) from relays
      const inboxRelays = await marmotClient.network.getUserInboxRelays(memberPubkey);
      const events = await marmotClient.network.request(
        [...new Set([...inboxRelays, ...DEFAULT_MLS_RELAYS])],
        [{ kinds: [443], authors: [memberPubkey], limit: 1 }],
      );

      if (events.length === 0) {
        throw new Error(
          'No key package found for this user. They may not have published one yet.',
        );
      }

      // Invite by key package event (handles Add → Commit → Welcome gift wrap)
      return group.inviteByKeyPackageEvent(events[0]!);
    },
    onSuccess: (_data, { group }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groupMembers(group.idStr) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.groups });
    },
  });
}
